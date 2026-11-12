# Plan: desplegar el backend en AWS con EC2 + CDK

Plan para sacar `api.clawpuzzle.com` (API NestJS + Postgres + Redis) de Railway
y llevarlo a AWS. El frontend sigue en Vercel.

Es la alternativa "de portafolio" al [RUNBOOK.md](RUNBOOK.md) de Lightsail:
mismo coste aproximado, pero montada con las piezas estándar de AWS e
infraestructura como código.

## Índice

1. [Por qué este plan](#1-por-qué-este-plan)
2. [Arquitectura](#2-arquitectura)
3. [Fase 0 — Preparar la cuenta](#3-fase-0--preparar-la-cuenta)
4. [Fase 1 — Infraestructura con CDK](#4-fase-1--infraestructura-con-cdk)
5. [Fase 2 — Secretos en Parameter Store](#5-fase-2--secretos-en-parameter-store)
6. [Fase 3 — Compose y script de deploy](#6-fase-3--compose-y-script-de-deploy)
7. [Fase 4 — CI/CD con GitHub Actions y OIDC](#7-fase-4--cicd-con-github-actions-y-oidc)
8. [Fase 5 — Ensayo, corte y cierre](#8-fase-5--ensayo-corte-y-cierre)
9. [Operación diaria](#9-operación-diaria)
10. [Costes](#10-costes)
11. [Reparto del trabajo y checklist](#11-reparto-del-trabajo-y-checklist)
12. [Glosario](#12-glosario)

---

## 1. Por qué este plan

### Contexto

- El 21-oct-2026 Railway sufrió un incidente que expuso las variables de entorno
  de sus clientes ([INCIDENTE_RAILWAY_2026-10.md](../INCIDENTE_RAILWAY_2026-10.md)).
  Todos los secretos del backend se tratan como filtrados.
- Además del objetivo técnico, este despliegue es un **proyecto de portafolio**
  para aprender AWS, con un presupuesto ajustado (~$20/mes).

### Opciones que se descartaron

| Opción | Coste/mes | Por qué no |
| --- | --- | --- |
| Lightsail con todo en un servidor | ~$12 | Barata y simple, pero esconde VPC, IAM, ECR, SSM: aporta poco al portafolio |
| Lightsail + base gestionada | ~$27 | Igual que la anterior en aprendizaje |
| EC2 + RDS + ElastiCache | ~$45 | RDS y ElastiCache duplican el coste |
| ECS Fargate + ALB + RDS + ElastiCache | ~$65–75 | Lo más "profesional", pero demasiado caro |
| Serverless (Lambda + SQS + Aurora) | variable | Obliga a reescribir 3 colas BullMQ y 4 crons; Aurora no llega a pausarse por el cron de cada 10 min, así que acaba saliendo más caro |

### La elección

**Una instancia EC2 con Docker Compose**, igual que el plan de Lightsail, pero:

- toda la infraestructura escrita en **AWS CDK** (TypeScript);
- **VPC, security groups y roles IAM** propios;
- **sin SSH**: acceso por **SSM Session Manager**;
- **secretos en Parameter Store**, no en archivos editados a mano;
- imágenes en **ECR**, construidas en GitHub y no en el servidor;
- **CI/CD con OIDC**: GitHub despliega sin access keys guardadas;
- backups en **S3** y **snapshots de EBS**, alarmas con **CloudWatch + SNS** y
  **AWS Budgets**.

La historia para el portafolio: *"Producción en un PaaS sufrió un incidente que
expuso sus variables de entorno. Migré el backend a AWS con infraestructura
como código, rotando todos los secretos a Parameter Store, con CI/CD por OIDC
sin credenciales de larga duración y sin puerto SSH abierto."*

---

## 2. Arquitectura

```
GitHub (push a main)
  └─ Actions: tests → build imagen ARM → push a ECR → orden de deploy por SSM
                                                              │
AWS · us-east-1 (todo creado con CDK)                         ▼
  VPC ─ subred pública ─ EC2 t4g.small (Ubuntu 24.04 arm64, Docker)
                           ├─ Caddy  :80/:443   ← único puerto abierto
                           ├─ API NestJS        (imagen de ECR)
                           ├─ Postgres 18       (volumen en el disco EBS)
                           └─ Redis 7           (colas BullMQ)
  Elastic IP          → registro DNS  A api.clawpuzzle.com
  Parameter Store     → secretos que el servidor lee al desplegar
  S3 (bucket de ops)  → deploy/ (compose, Caddyfile) · postgres/ (backups) · transfer/
  Snapshots EBS (DLM) → backup diario del disco entero
  CloudWatch + SNS    → alarmas al email
  Budgets             → aviso de gasto
```

Qué **no** cambia respecto al plan de Lightsail:

- La aplicación, el `backend/Dockerfile` (targets `runtime` y `migrate`) y casi
  todo el `docker-compose.yml` y el `Caddyfile`.
- El dominio `api.clawpuzzle.com`: no hay que tocar los webhooks de Shopify,
  CORS, cookies ni OAuth de Google.
- El procedimiento de corte: dump, restore, comparar conteos, DNS y
  `orders/sync`.

---

## 3. Fase 0 — Preparar la cuenta

A mano, una sola vez. Lo hace el dueño de la cuenta.

### 3.1 Usuario root

- Activar **MFA** en el root (*IAM → Security credentials*).
- No crear access keys para el root y no volver a usarlo en el día a día.

### 3.2 Usuario IAM + `aws login` (usuario del día a día)

**Qué es:** `aws login` (AWS CLI v2 ≥ 2.32) reutiliza el inicio de sesión de la
consola (usuario IAM + contraseña + MFA) y entrega a la CLI **credenciales
temporales**. No hacen falta access keys permanentes en el disco ni IAM Identity
Center (que exige crear una organización de AWS Organizations).

1. Consola (como root, por última vez) → *IAM → Users → Create user*:
   - nombre p. ej. `david`, con **acceso a la consola** y contraseña propia;
   - permisos: adjuntar la política `AdministratorAccess` (incluye los permisos
     `signin:*` que usa `aws login`; si algún día se restringe, añadir
     `SignInLocalDevelopmentAccess`).
2. Entrar a la consola con ese usuario
   (`https://aws-iam-davit.signin.aws.amazon.com/console`) y activar **MFA**
   (*IAM → Users → david → Security credentials*).
3. En WSL:

   ```bash
   aws login --profile clawpuzzle      # abre el navegador; pide la región (us-east-1)
   aws sts get-caller-identity --profile clawpuzzle   # comprobar: Arn ...:user/david
   export AWS_PROFILE=clawpuzzle
   ```

   Cuando la sesión caduque, repetir `aws login --profile clawpuzzle`.

4. Si alguna herramienta (CDK, Docker, scripts) no reconoce el perfil de
   `aws login`, exportar las credenciales temporales a la shell:

   ```bash
   eval "$(aws configure export-credentials --profile clawpuzzle --format env)"
   ```

### 3.3 Presupuesto

*Billing → Budgets → Create budget* → *Monthly cost budget* de **$25** con aviso
por email al 80 % (real) y al 100 % (previsto). Los dos primeros presupuestos
son gratis.

Revisar también *Billing → Credits*: las cuentas nuevas reciben créditos de
bienvenida que pueden cubrir los primeros meses.

### 3.4 Herramientas en WSL

```bash
# AWS CLI v2
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o awscliv2.zip
unzip awscliv2.zip && sudo ./aws/install && rm -rf aws awscliv2.zip

# Plugin de Session Manager (para entrar al servidor sin SSH)
curl "https://s3.amazonaws.com/session-manager-downloads/plugin/latest/ubuntu_64bit/session-manager-plugin.deb" -o smp.deb
sudo dpkg -i smp.deb && rm smp.deb

# CDK
npm install -g aws-cdk
cdk --version
```

### 3.5 Bootstrap de CDK

```bash
cdk bootstrap aws://<ACCOUNT_ID>/us-east-1
```

Crea un stack `CDKToolkit` con un bucket y unos roles que CDK usa para subir
assets y desplegar. Se hace una vez por cuenta y región.

---

## 4. Fase 1 — Infraestructura con CDK

### 4.1 Qué es CDK y cómo se trabaja

**CDK** (Cloud Development Kit) permite describir la infraestructura en
TypeScript. Al ejecutarlo, CDK genera una plantilla de **CloudFormation** y
CloudFormation crea, modifica o borra los recursos para que coincidan con el
código.

Ventajas:

- Todo queda versionado en el repo (`infra/`), revisable en un PR.
- `cdk diff` enseña exactamente qué va a cambiar antes de aplicarlo.
- Reproducible: se puede levantar un entorno igual en otra cuenta o región.
- Nada queda "olvidado" en la consola: si se borra el stack, desaparece todo
  (salvo lo marcado como `RETAIN`, como el bucket de backups).

Estructura propuesta:

```
infra/
├── bin/infra.ts              # punto de entrada: instancia el stack
├── lib/clawpuzzle-stack.ts   # todos los recursos
├── assets/user-data.sh       # script de primer arranque del servidor
├── cdk.json
├── package.json
└── tsconfig.json
```

Comandos:

```bash
cd infra
npm ci
npx cdk synth     # genera la plantilla (comprueba que compila)
npx cdk diff      # qué cambiaría en AWS
npx cdk deploy    # aplica los cambios (pide confirmación si toca IAM o security groups)
```

El stack exporta como **outputs** los valores que hacen falta después:
`InstanceId`, `ElasticIp`, `EcrRegistry`, `OpsBucket`, `DeployRoleArn` y
`AlarmTopicArn`.

### 4.2 Red: VPC y security group

**VPC** (Virtual Private Cloud): tu red privada dentro de AWS. Se divide en
**subredes**. Una subred es *pública* si tiene ruta a un Internet Gateway (sus
máquinas pueden tener IP pública).

**NAT Gateway:** lo que permite salir a internet a las subredes *privadas*.
Cuesta ~$32/mes, así que **no se crea**: la instancia va en una subred pública y
lo que la protege es el security group.

**Security group:** firewall a nivel de instancia, con estado (si se permite la
entrada, la respuesta sale sola). Por defecto bloquea toda la entrada.

```ts
const vpc = new ec2.Vpc(this, 'Vpc', {
  maxAzs: 1,
  natGateways: 0,
  subnetConfiguration: [{ name: 'public', subnetType: ec2.SubnetType.PUBLIC }],
});

const sg = new ec2.SecurityGroup(this, 'ApiSg', {
  vpc,
  description: 'Caddy: HTTP/HTTPS publicos. Sin SSH.',
  allowAllOutbound: true,
});
sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'HTTP (redirige a HTTPS y ACME)');
sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), 'HTTPS');
sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.udp(443), 'HTTP/3');
// Sin regla para el puerto 22: se entra por Session Manager.
```

Postgres (5432), Redis (6379) y la API (3001) no se publican: solo existen en la
red interna de Docker Compose, igual que en el plan de Lightsail.

### 4.3 Rol IAM de la instancia

**Qué es:** un rol es un conjunto de permisos que una entidad (aquí, la EC2)
"asume". AWS le entrega **credenciales temporales** a través del servicio de
metadatos de la instancia, y las rota sola. En el servidor no hay ninguna clave
guardada.

Principio de **mínimo privilegio**: solo lo que necesita.

| Permiso | Para qué |
| --- | --- |
| `AmazonSSMManagedInstanceCore` (gestionada por AWS) | Que SSM gestione la instancia: Session Manager y Run Command |
| `ecr:GetAuthorizationToken`, `ecr:BatchGetImage`, `ecr:GetDownloadUrlForLayer` sobre los 2 repos | Descargar las imágenes |
| `ssm:GetParametersByPath` sobre `/clawpuzzle/prod/*` + `kms:Decrypt` de la clave `aws/ssm` | Leer los secretos |
| `s3:GetObject`/`ListBucket` sobre `deploy/` y `transfer/` | Descargar compose, Caddyfile y el dump del corte |
| `s3:PutObject` sobre `postgres/` | Subir backups (no puede leerlos ni borrarlos) |

```ts
const role = new iam.Role(this, 'InstanceRole', {
  assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
  managedPolicies: [
    iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
  ],
});
backendRepo.grantPull(role);
migrateRepo.grantPull(role);
opsBucket.grantRead(role, 'deploy/*');
opsBucket.grantRead(role, 'transfer/*');
opsBucket.grantPut(role, 'postgres/*');
role.addToPolicy(new iam.PolicyStatement({
  actions: ['ssm:GetParametersByPath'],
  resources: [
    `arn:aws:ssm:${this.region}:${this.account}:parameter/clawpuzzle/prod/*`,
    `arn:aws:ssm:${this.region}:${this.account}:parameter/clawpuzzle/staging/*`, // quitar tras el ensayo
  ],
}));
```

### 4.4 La instancia EC2

| Elección | Motivo |
| --- | --- |
| `t4g.small` (2 vCPU, 2 GB) | Graviton (ARM): ~20 % más barata que la x86 equivalente. 2 GB caben Postgres + Redis + Nest sin build en el servidor |
| Ubuntu 24.04 arm64 | La misma base del runbook. El agente de SSM viene preinstalado |
| EBS gp3 20 GB cifrado | Disco del sistema y de los volúmenes de Docker |
| IMDSv2 obligatorio | Protege las credenciales del rol frente a ataques SSRF |
| Elastic IP | IP fija para el DNS; no cambia al parar o recuperar la instancia |

```ts
const instance = new ec2.Instance(this, 'Api', {
  vpc,
  securityGroup: sg,
  role,
  instanceType: new ec2.InstanceType('t4g.small'),
  machineImage: ec2.MachineImage.fromSsmParameter(
    '/aws/service/canonical/ubuntu/server/24.04/stable/current/arm64/hvm/ebs-gp3/ami-id',
  ),
  blockDevices: [{
    deviceName: '/dev/sda1',
    volume: ec2.BlockDeviceVolume.ebs(20, {
      volumeType: ec2.EbsDeviceVolumeType.GP3,
      encrypted: true,
    }),
  }],
  requireImdsv2: true,
  userData,
});
cdk.Tags.of(instance).add('Backup', 'daily');   // lo usa la política de snapshots

new ec2.CfnEIP(this, 'Ip', { instanceId: instance.instanceId });
```

> **Cuidado con la AMI:** el parámetro apunta siempre a la última versión de
> Ubuntu. Si cambia, un `cdk deploy` querría **reemplazar** la instancia (y su
> disco con la base). Se fija la AMI tras el primer deploy (por ejemplo con
> `cachedInContext: true`) y `cdk diff` lo dejaría ver antes de aplicar.

**User data** (`infra/assets/user-data.sh`): se ejecuta como root **solo en el
primer arranque**.

```bash
#!/usr/bin/env bash
set -euxo pipefail

# Docker + plugin de Compose
curl -fsSL https://get.docker.com | sh
usermod -aG docker ubuntu

# AWS CLI v2 (arm64)
apt-get update && apt-get install -y unzip
curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-aarch64.zip" -o /tmp/awscli.zip
unzip -q /tmp/awscli.zip -d /tmp && /tmp/aws/install && rm -rf /tmp/aws /tmp/awscli.zip

# Configuración no secreta que necesitan los scripts (CDK sustituye los valores)
mkdir -p /opt/clawpuzzle/deploy /opt/clawpuzzle/bin
cat > /opt/clawpuzzle/config.env <<EOF
AWS_REGION=${REGION}
ECR_REGISTRY=${ECR_REGISTRY}
OPS_BUCKET=${OPS_BUCKET}
EOF
chown -R ubuntu:ubuntu /opt/clawpuzzle
```

Los scripts `deploy.sh` y `backup.sh` no van en el user data: viajan con cada
deploy (en `deploy/`), así se pueden cambiar sin recrear la instancia.

### 4.5 ECR (registro de imágenes)

**Qué es:** el registro privado de imágenes Docker de AWS. La instancia descarga
de aquí con su rol; GitHub sube aquí con el suyo.

- Dos repositorios: `clawpuzzle-backend` (target `runtime`) y
  `clawpuzzle-migrate` (target `migrate`).
- Etiquetas **inmutables**: cada imagen se etiqueta con el SHA del commit y no
  se puede sobrescribir. Así se sabe exactamente qué código corre en producción.
- **Regla de ciclo de vida**: conservar las últimas 10 imágenes, para que el
  almacenamiento no crezca.
- **Escaneo al subir** (*scan on push*): ECR avisa de vulnerabilidades conocidas
  en la imagen.

```ts
const backendRepo = new ecr.Repository(this, 'BackendRepo', {
  repositoryName: 'clawpuzzle-backend',
  imageTagMutability: ecr.TagMutability.IMMUTABLE,
  imageScanOnPush: true,
  lifecycleRules: [{ maxImageCount: 10 }],
});
// igual para clawpuzzle-migrate
```

### 4.6 Bucket S3 de operaciones

Un único bucket privado con tres prefijos:

| Prefijo | Contenido | Ciclo de vida |
| --- | --- | --- |
| `deploy/` | `docker-compose.yml`, `Caddyfile`, scripts (los sube GitHub) | Se sobrescribe en cada deploy |
| `postgres/` | Dumps diarios de la base | Borrar a los 30 días |
| `transfer/` | El dump de Railway durante el ensayo y el corte | Borrar al día siguiente |

- **Block Public Access** activado y cifrado por defecto.
- **Versionado** activado: si algo borra o sobrescribe un backup, se puede
  recuperar la versión anterior.
- `removalPolicy: RETAIN`: borrar el stack no borra los backups.

```ts
const opsBucket = new s3.Bucket(this, 'OpsBucket', {
  blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
  encryption: s3.BucketEncryption.S3_MANAGED,
  enforceSSL: true,
  versioned: true,
  removalPolicy: cdk.RemovalPolicy.RETAIN,
  lifecycleRules: [
    { prefix: 'postgres/', expiration: cdk.Duration.days(30), noncurrentVersionExpiration: cdk.Duration.days(7) },
    { prefix: 'transfer/', expiration: cdk.Duration.days(1) },
  ],
});
```

**Por qué importa:** la copia de la base vive **fuera del servidor**. Si la
instancia o su disco se pierden, los datos siguen a salvo.

### 4.7 Snapshots del disco (Data Lifecycle Manager)

**Qué es:** DLM crea y borra snapshots de EBS según una política. Un snapshot es
una copia del disco entero en un momento dado; son incrementales (solo se paga
lo que cambia).

Política: cada día a las 07:00 UTC, a los volúmenes con la etiqueta
`Backup=daily`, conservar los 7 últimos.

```ts
new dlm.CfnLifecyclePolicy(this, 'DailySnapshots', {
  description: 'Snapshot diario del disco de la API',
  state: 'ENABLED',
  executionRoleArn: dlmRole.roleArn,
  policyDetails: {
    resourceTypes: ['VOLUME'],
    targetTags: [{ key: 'Backup', value: 'daily' }],
    schedules: [{
      name: 'daily',
      createRule: { interval: 24, intervalUnit: 'HOURS', times: ['07:00'] },
      retainRule: { count: 7 },
      copyTags: true,
    }],
  },
});
```

Snapshot y dump se complementan:

- **Snapshot:** restaura el servidor entero (sistema, Docker, certificados,
  base) en minutos.
- **Dump en S3:** restaura solo la base, en cualquier sitio (otra instancia, RDS,
  tu máquina).

Restaurar desde un snapshot: crear un volumen a partir de él y lanzar una
instancia con ese volumen (o sustituir el de la actual).

### 4.8 Alarmas y avisos

**CloudWatch** recoge métricas de la instancia (CPU, red, status checks).
**SNS** es un servicio de notificaciones: un *topic* al que se suscribe tu email.

| Alarma | Acción |
| --- | --- |
| `StatusCheckFailed_System` (fallo del hardware de AWS) | **Recover**: AWS mueve la instancia a otro host, con la misma IP y el mismo disco. Aviso por email |
| `StatusCheckFailed_Instance` (el sistema operativo no responde) | **Reboot** y aviso |
| CPU > 80 % durante 15 min | Aviso |
| Créditos de CPU bajos (`CPUCreditBalance`) | Aviso. Las `t4g` son *burstable*: acumulan créditos y los gastan en los picos |

```ts
const topic = new sns.Topic(this, 'Alarms');
topic.addSubscription(new subs.EmailSubscription('<tu email>'));   // confirmar el email que llega

const systemCheck = new cloudwatch.Alarm(this, 'SystemCheck', {
  metric: new cloudwatch.Metric({
    namespace: 'AWS/EC2',
    metricName: 'StatusCheckFailed_System',
    dimensionsMap: { InstanceId: instance.instanceId },
    statistic: 'Maximum',
    period: cdk.Duration.minutes(1),
  }),
  threshold: 1,
  evaluationPeriods: 2,
});
systemCheck.addAlarmAction(new actions.Ec2Action(actions.Ec2InstanceAction.RECOVER));
systemCheck.addAlarmAction(new actions.SnsAction(topic));
```

**Disco lleno:** las métricas de disco no vienen por defecto (hace falta el
CloudWatch Agent). Para empezar basta con revisar `df -h` y la rotación de logs
de Docker que ya trae el compose. El agente queda como mejora.

**Monitor externo:** CloudWatch ve la máquina, no si la API responde. Dar de alta
`https://api.clawpuzzle.com/api/health` en **UptimeRobot** o **Better Stack**
(gratis, aviso por email).

---

## 5. Fase 2 — Secretos en Parameter Store

### 5.1 Qué es

**SSM Parameter Store** guarda valores de configuración. Los de tipo
**`SecureString`** se cifran con **KMS** (por defecto con la clave `aws/ssm`, sin
coste). El nivel estándar es gratis hasta 10.000 parámetros.

Frente a **Secrets Manager** ($0,40 por secreto al mes), Parameter Store no
rota secretos automáticamente, pero para este proyecto no hace falta.

### 5.2 Estructura

```
/clawpuzzle/prod/infra/POSTGRES_PASSWORD        → deploy/.env
/clawpuzzle/prod/infra/REDIS_PASSWORD
/clawpuzzle/prod/infra/API_DOMAIN               (String)
/clawpuzzle/prod/infra/ACME_EMAIL               (String)

/clawpuzzle/prod/backend/JWT_ACCESS_SECRET      → deploy/.env.backend
/clawpuzzle/prod/backend/JWT_REFRESH_SECRET
/clawpuzzle/prod/backend/FAL_KEY
/clawpuzzle/prod/backend/SHOPIFY_ADMIN_API_TOKEN
/clawpuzzle/prod/backend/SHOPIFY_WEBHOOK_SECRET
/clawpuzzle/prod/backend/CLOUDINARY_API_KEY
/clawpuzzle/prod/backend/CLOUDINARY_API_SECRET
/clawpuzzle/prod/backend/GOOGLE_CLIENT_SECRET
/clawpuzzle/prod/backend/WEBHOOK_SECRET
/clawpuzzle/prod/backend/NODE_ENV               (String: lo no secreto también va aquí)
/clawpuzzle/prod/backend/FRONTEND_URL           (String)
... (una por cada variable de deploy/.env.backend.example)
```

El nombre final del parámetro es el nombre de la variable. Para el ensayo se usa
otra ruta (`/clawpuzzle/staging/...`) con credenciales falsas.

### 5.3 Cómo se cargan (y dónde entra la rotación)

Aquí se hace la **rotación de los secretos filtrados en Railway**: en Parameter
Store se ponen **claves nuevas**, nunca las que estaban en Railway (salvo los
JWT; ver [8.3](#83-corte)).

- **Claves de terceros** (fal, Cloudinary, Google, Shopify): se generan en el
  panel del proveedor y se pegan **directamente** en la consola de AWS
  (*Systems Manager → Parameter Store → Create parameter → SecureString*). No
  pasan por el chat, ni por archivos, ni por el historial de la terminal.
- **Secretos aleatorios** (contraseñas de Postgres y Redis, `WEBHOOK_SECRET`):
  se generan y guardan en el mismo comando, sin imprimirlos:

  ```bash
  aws ssm put-parameter --type SecureString \
    --name /clawpuzzle/prod/infra/REDIS_PASSWORD \
    --value "$(openssl rand -hex 32)"
  ```

  Hex porque van dentro de URLs: un `@` o un `/` las romperían.

### 5.4 Cómo llegan al contenedor

En cada deploy, `deploy.sh` lee los parámetros con el rol de la instancia y
escribe `deploy/.env` y `deploy/.env.backend` con permisos `600`. El compose los
sigue leyendo como ahora: **la aplicación no cambia**.

```bash
# Convierte /clawpuzzle/prod/backend/FAL_KEY=xxx en FAL_KEY=xxx
render_env() {
  aws ssm get-parameters-by-path --path "$1" --recursive --with-decryption \
    --query 'Parameters[].[Name,Value]' --output text \
  | while IFS=$'\t' read -r name value; do
      printf '%s=%s\n' "${name##*/}" "$value"
    done
}
```

Los archivos quedan en un disco cifrado y solo los lee el usuario `ubuntu`. Para
cambiar un secreto: editarlo en Parameter Store y relanzar el deploy.

---

## 6. Fase 3 — Compose y script de deploy

### 6.1 Cambios en `deploy/`

Hoy el compose hace `build:` en el servidor. En AWS el build se hace en GitHub y
el servidor solo descarga:

```yaml
# deploy/docker-compose.yml
  migrate:
    image: ${ECR_REGISTRY}/clawpuzzle-migrate:${IMAGE_TAG:?falta IMAGE_TAG}
    # ...
  backend:
    image: ${ECR_REGISTRY}/clawpuzzle-backend:${IMAGE_TAG:?falta IMAGE_TAG}
    # ...
```

El `build:` pasa a un archivo aparte para seguir levantándolo en local:

```yaml
# deploy/docker-compose.build.yml
services:
  migrate:
    build: { context: ../backend, target: migrate }
  backend:
    build: { context: ../backend, target: runtime }
```

```bash
# en local
docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build
```

Consecuencias:

- No hace falta **swap**: el servidor ya no compila.
- No hace falta **clonar el repo** en el servidor ni una deploy key de GitHub.
- `ECR_REGISTRY` lo añade `deploy.sh` a `deploy/.env` (sale de `config.env`).

### 6.2 `deploy/bin/deploy.sh`

Lo ejecuta GitHub a través de SSM (fase 4). También se puede lanzar a mano
desde una sesión de Session Manager. En el ensayo se lanza con
`ENV_PATH=/clawpuzzle/staging deploy.sh <sha>` (y el rol de la instancia también
necesita leer esa ruta).

```bash
#!/usr/bin/env bash
# Uso: deploy.sh <tag>   (tag = SHA del commit, ya subido a ECR)
set -euo pipefail
TAG="${1:?uso: deploy.sh <tag>}"
source /opt/clawpuzzle/config.env           # AWS_REGION, ECR_REGISTRY, OPS_BUCKET
ENV_PATH="${ENV_PATH:-/clawpuzzle/prod}"    # /clawpuzzle/staging en el ensayo
cd /opt/clawpuzzle

# 1. Compose, Caddyfile y scripts de este commit
aws s3 sync "s3://$OPS_BUCKET/deploy/" ./deploy/ --delete --exclude '.env*'
chmod +x deploy/bin/*.sh

# 2. Secretos → archivos de entorno (solo legibles por el usuario)
source deploy/bin/render-env.sh             # define render_env()
(
  umask 077
  { render_env "$ENV_PATH/infra/"; echo "ECR_REGISTRY=$ECR_REGISTRY"; } > deploy/.env
  render_env "$ENV_PATH/backend/" > deploy/.env.backend
)

# 3. Imágenes y arranque
aws ecr get-login-password --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin "$ECR_REGISTRY"
cd deploy
export IMAGE_TAG="$TAG"
docker compose pull migrate backend
docker compose up -d                        # migrate → backend → caddy, como ahora
echo "$TAG" > /opt/clawpuzzle/CURRENT_TAG   # qué versión corre

# 4. Limpieza de imágenes viejas
docker image prune -af --filter "until=168h"
```

**Corte del servicio:** al recrear el contenedor de la API hay unos segundos sin
servicio. Para este proyecto es aceptable. Evitarlo exigiría un balanceador y
dos instancias (ver la opción ECS en la sección 1).

**Vuelta atrás:** las imágenes siguen en ECR, así que basta con relanzar
`deploy.sh` con el SHA anterior. **Excepción:** si la versión nueva aplicó una
migración que rompe la anterior, hay que revertir también la migración (o
restaurar el backup).

### 6.3 `deploy/bin/backup.sh` y cron

```bash
#!/usr/bin/env bash
set -euo pipefail
source /opt/clawpuzzle/config.env
cd /opt/clawpuzzle/deploy
docker compose exec -T postgres pg_dump -U clawpuzzle -d clawpuzzle -Fc \
  | aws s3 cp - "s3://$OPS_BUCKET/postgres/clawpuzzle-$(date -u +%F).dump"
```

El dump va directo a S3, sin pasar por el disco. Cron del usuario `ubuntu`
(07:30 UTC = 02:30 en Ecuador, fuera de los crons de la app):

```cron
30 7 * * * /opt/clawpuzzle/deploy/bin/backup.sh >> /home/ubuntu/backup.log 2>&1
```

**Probar la restauración** al menos una vez (un backup que nunca se ha
restaurado no se sabe si funciona):

```bash
aws s3 cp s3://<OPS_BUCKET>/postgres/clawpuzzle-<fecha>.dump - \
  | docker run --rm -i postgres:18 pg_restore -l | head
```

---

## 7. Fase 4 — CI/CD con GitHub Actions y OIDC

### 7.1 El problema que resuelve OIDC

La forma antigua: crear un usuario IAM, generar access keys y guardarlas como
secreto en GitHub. Son **credenciales de larga duración**: si se filtran
(justo lo que pasó en Railway), sirven hasta que alguien las revoque.

Con **OIDC** (OpenID Connect):

1. En cada ejecución, GitHub emite un **token firmado** que dice, por ejemplo:
   *"soy un workflow del repo `davitpra/clawpuzzle`, rama `main`"*.
2. AWS verifica la firma contra el proveedor de identidad de GitHub que se
   registró en la cuenta.
3. Si las condiciones del rol coinciden (repo y rama), AWS entrega
   **credenciales temporales de 1 hora** para ese rol.

En GitHub no se guarda ninguna clave. Un fork o una rama que no sea `main` no
puede desplegar.

### 7.2 En CDK

```ts
const github = new iam.OpenIdConnectProvider(this, 'GitHubOidc', {
  url: 'https://token.actions.githubusercontent.com',
  clientIds: ['sts.amazonaws.com'],
});

const deployRole = new iam.Role(this, 'GitHubDeployRole', {
  roleName: 'clawpuzzle-github-deploy',
  maxSessionDuration: cdk.Duration.hours(1),
  assumedBy: new iam.WebIdentityPrincipal(github.openIdConnectProviderArn, {
    StringEquals: {
      'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
      'token.actions.githubusercontent.com:sub': 'repo:davitpra/clawpuzzle:ref:refs/heads/main',
    },
  }),
});

backendRepo.grantPullPush(deployRole);
migrateRepo.grantPullPush(deployRole);
opsBucket.grantReadWrite(deployRole, 'deploy/*');
deployRole.addToPolicy(new iam.PolicyStatement({
  actions: ['ssm:SendCommand'],
  resources: [
    `arn:aws:ec2:${this.region}:${this.account}:instance/${instance.instanceId}`,
    `arn:aws:ssm:${this.region}::document/AWS-RunShellScript`,
  ],
}));
deployRole.addToPolicy(new iam.PolicyStatement({
  actions: ['ssm:GetCommandInvocation'],
  resources: ['*'],
}));
```

El rol solo puede: subir imágenes a esos 2 repos, escribir en `deploy/` y
mandar comandos a **esa** instancia. No puede leer secretos ni backups.

### 7.3 Run Command

**SSM Run Command** ejecuta un script en la instancia a través del agente de
SSM, sin SSH. GitHub lo usa para lanzar `deploy.sh`; la salida queda en la
consola de SSM y se puede leer desde el workflow.

### 7.4 El job de deploy en `.github/workflows/ci.yml`

Variables del repo (*Settings → Secrets and variables → Actions → Variables*;
no son secretos): `AWS_DEPLOY_ROLE_ARN`, `AWS_REGION`, `ECR_REGISTRY`,
`OPS_BUCKET`, `INSTANCE_ID`. Salen de los outputs del stack.

```yaml
  deploy:
    needs: backend                       # solo si pasan typecheck, lint y tests
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-24.04-arm            # build ARM nativo, sin emulación
    concurrency: { group: deploy-prod, cancel-in-progress: false }
    permissions:
      id-token: write                    # necesario para pedir el token OIDC
      contents: read
    env:
      ECR_REGISTRY: ${{ vars.ECR_REGISTRY }}
      TAG: ${{ github.sha }}
    steps:
      - uses: actions/checkout@v4

      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ vars.AWS_DEPLOY_ROLE_ARN }}
          aws-region: ${{ vars.AWS_REGION }}

      - uses: aws-actions/amazon-ecr-login@v2

      - name: Build y push de las imágenes
        run: |
          docker build --target runtime -t "$ECR_REGISTRY/clawpuzzle-backend:$TAG" backend
          docker build --target migrate -t "$ECR_REGISTRY/clawpuzzle-migrate:$TAG" backend
          docker push "$ECR_REGISTRY/clawpuzzle-backend:$TAG"
          docker push "$ECR_REGISTRY/clawpuzzle-migrate:$TAG"

      - name: Subir compose, Caddyfile y scripts
        run: aws s3 sync deploy/ "s3://${{ vars.OPS_BUCKET }}/deploy/" --delete --exclude '.env*' --exclude '*.md'

      - name: Desplegar en la instancia
        run: |
          CMD_ID=$(aws ssm send-command \
            --instance-ids "${{ vars.INSTANCE_ID }}" \
            --document-name AWS-RunShellScript \
            --parameters "commands=[\"sudo -iu ubuntu bash -c 'source /opt/clawpuzzle/config.env && aws s3 sync s3://\$OPS_BUCKET/deploy/bin/ /opt/clawpuzzle/deploy/bin/ && bash /opt/clawpuzzle/deploy/bin/deploy.sh $TAG'\"]" \
            --query Command.CommandId --output text)
          aws ssm wait command-executed --command-id "$CMD_ID" --instance-id "${{ vars.INSTANCE_ID }}" || true
          aws ssm get-command-invocation --command-id "$CMD_ID" --instance-id "${{ vars.INSTANCE_ID }}" \
            --query '[Status, StandardOutputContent, StandardErrorContent]' --output text
          test "$(aws ssm get-command-invocation --command-id "$CMD_ID" --instance-id "${{ vars.INSTANCE_ID }}" --query Status --output text)" = Success

      - name: Comprobar salud
        run: curl -fsS --retry 10 --retry-delay 6 --retry-all-errors https://api.clawpuzzle.com/api/health
```

Notas:

- Los runners ARM (`ubuntu-24.04-arm`) en repos privados consumen minutos del
  plan de GitHub. Si se acaban, la alternativa es `ubuntu-latest` con
  `docker/setup-qemu-action` + `buildx --platform linux/arm64` (más lento).
- El comando descarga primero `deploy/bin/` de S3 y luego lanza `deploy.sh`:
  así funciona también en el primer deploy, cuando el script aún no está en el
  servidor, y siempre corre la versión del commit que se despliega.
- El primer deploy (antes del corte) se hace con `workflow_dispatch` o a mano,
  para no apuntar a producción antes de tiempo.

**Resultado:** push a `main` → tests → imagen en ECR → producción actualizada.
Cada versión desplegada se corresponde con un commit.

---

## 8. Fase 5 — Ensayo, corte y cierre

Sigue el [RUNBOOK.md](RUNBOOK.md) de Lightsail, con las diferencias de abajo.
Las secciones de verificación (conteos, comprobaciones, `orders/sync` y vuelta
atrás) se aplican tal cual.

### 8.1 Preparación

| Runbook de Lightsail | En este plan |
| --- | --- |
| 1.1 Cuenta | [Fase 0](#3-fase-0--preparar-la-cuenta) |
| 1.2 Crear instancia, IP, firewall, snapshots | `cdk deploy` ([fase 1](#4-fase-1--infraestructura-con-cdk)) |
| 1.3 Docker, swap, clonar repo | User data; sin swap ni repo |
| `ssh -i ...pem` | `aws ssm start-session --target <InstanceId>` |

### 8.2 Ensayo

1. Namecheap: `A` · host `api-aws` · valor `<ElasticIp>` · TTL 1 min.
2. Parámetros en `/clawpuzzle/staging/...` con credenciales **falsas**
   (`MOCK_AI=true`, token de Shopify falso, `ACCOUNT_LIFECYCLE_ENABLED=false`,
   `API_DOMAIN=api-aws.clawpuzzle.com`) y lanzar
   `ENV_PATH=/clawpuzzle/staging deploy.sh <sha>`. El motivo está en el runbook: con el token real de Shopify, la API
   registraría webhooks hacia el servidor de ensayo.
3. Dump de Railway como en el runbook (2.3) y **transferencia por S3** en vez de
   `scp`:

   ```bash
   [local]  aws s3 cp ~/clawpuzzle-prod.dump s3://<OPS_BUCKET>/transfer/
   [server] aws s3 cp s3://<OPS_BUCKET>/transfer/clawpuzzle-prod.dump ~/
   ```

   El prefijo `transfer/` se borra solo al día siguiente. El dump tiene datos
   personales: borrarlo también de local y del servidor al terminar.
4. Restaurar, arrancar y comprobar como en el runbook (2.4 y 2.5).
5. Limpiar (2.6) y borrar el registro `api-aws`.

### 8.3 Corte

Igual que el runbook (sección 3), con estos cambios:

- **Variables (3.1):** en lugar de copiar las de Railway, se cargan en
  `/clawpuzzle/prod/...` con **claves nuevas** de cada proveedor (rotación de la
  fase B del plan de incidente). Se hace **antes** del día del corte, con
  cuidado de no revocar todavía las viejas, que Railway sigue usando.
- **Excepción, los JWT:** si se mantienen los `JWT_*_SECRET` de Railway, las
  sesiones abiertas siguen valiendo. Si se cambian (están filtrados), todos los
  usuarios tienen que volver a iniciar sesión. Recomendado: **cambiarlos** en el
  corte, porque es el momento en el que ya hay una ventana de mantenimiento.
- **Shopify (lo más delicado):** seguir el paso B3 del plan de incidente para
  rotar el client secret y el token de la app ClawArt, respetando su límite de
  1 hora.
- **Dump y restore (3.3):** transferencia por S3 como en el ensayo.
- **Arranque (3.5):** `deploy.sh <SHA actual>` y cambio de DNS (borrar el
  `CNAME api` y el `TXT` de Railway, crear `A api` → `<ElasticIp>`).

### 8.4 Después del corte

1. Activar el cron de `backup.sh` y comprobar que aparece el primer dump en S3.
2. Activar el job de deploy automático en `ci.yml`.
3. Dar de alta el monitor externo.
4. **Una semana estable** →
   - revocar las claves viejas en cada proveedor (fase D del plan de incidente);
   - borrar los servicios `backend`, `Postgres` y `Redis` de Railway;
   - subir el TTL del `A api` (p. ej. 30 min);
   - actualizar `backend/docs/DEPLOY.md` y la sección *Deployment* de
     `backend/CLAUDE.md`.

---

## 9. Operación diaria

```bash
# Entrar al servidor
aws ssm start-session --target <InstanceId>
sudo -iu ubuntu && cd /opt/clawpuzzle/deploy

# Estado y logs
docker compose ps
docker compose logs -f --tail 100 backend
cat /opt/clawpuzzle/CURRENT_TAG            # qué commit corre

# Base de datos
docker compose exec postgres psql -U clawpuzzle -d clawpuzzle

# Disco
df -h /

# Desplegar una versión concreta (p. ej. volver atrás)
/opt/clawpuzzle/deploy/bin/deploy.sh <sha>

# Cambiar la infraestructura
cd infra && npx cdk diff && npx cdk deploy
```

Parches del sistema: Ubuntu trae `unattended-upgrades` activo. Opcional: *SSM
Patch Manager* para programarlos y ver el estado desde la consola.

---

## 10. Costes

Aproximados, us-east-1, precios bajo demanda.

| Recurso | $/mes |
| --- | --- |
| EC2 `t4g.small` | ~12,30 |
| IPv4 pública (Elastic IP) | ~3,60 |
| EBS gp3 20 GB | ~1,60 |
| Snapshots EBS (7 días, incrementales) | ~0,50–1 |
| ECR (10 imágenes por repo) | ~0,20 |
| S3 (backups 30 días) | < 0,10 |
| Parameter Store estándar, KMS `aws/ssm` | 0 |
| CloudWatch (alarmas básicas), SNS email, Budgets | 0 |
| Transferencia de salida (primeros 100 GB/mes) | 0 |
| **Total** | **~$18–20** |

Cómo mantenerlo bajo:

- **No crear NAT Gateways** (~$32/mes cada uno).
- No mandar todos los logs a CloudWatch Logs ($0,50/GB ingerido). Docker guarda
  los logs en el disco con rotación (ya configurado en el compose).
- Tras unos meses estable: un **Compute Savings Plan** de 1 año baja la EC2
  ~30–40 %.
- Revisar *Cost Explorer* la primera semana para confirmar que no hay sorpresas.

---

## 11. Reparto del trabajo y checklist

### Código (Claude)

- [ ] `infra/`: proyecto CDK con todo el stack de la fase 1.
- [ ] `infra/assets/user-data.sh`.
- [ ] `deploy/docker-compose.yml` con imágenes de ECR y
      `deploy/docker-compose.build.yml` para local.
- [ ] `deploy/bin/deploy.sh`, `render-env.sh` y `backup.sh`.
- [ ] Job `deploy` en `.github/workflows/ci.yml`.
- [ ] Runbook de corte adaptado a este plan.

### Manual (dueño de la cuenta)

- [ ] Fase 0: MFA en root, usuario IAM + `aws login`, presupuesto, herramientas,
      `cdk bootstrap`.
- [ ] `cdk deploy` con la sesión de `aws login` y confirmar la suscripción de SNS por email.
- [ ] Variables del repo en GitHub con los outputs del stack.
- [ ] Parámetros de staging y ensayo completo.
- [ ] Claves nuevas en cada proveedor → Parameter Store `prod`.
- [ ] Corte: DNS en Namecheap, verificación, `orders/sync`.
- [ ] Una semana después: revocar claves viejas y cerrar Railway.

### Pendientes del plan de incidente que siguen abiertos

- [ ] A3: revisar consumo y abuso en fal, Cloudinary, Shopify y Audit Logs de
      Railway.
- [ ] A4: forense de solo lectura en la base.

---

## 12. Glosario

| Término | Qué es |
| --- | --- |
| **AMI** | Imagen de disco con el sistema operativo con la que arranca una EC2 |
| **CDK** | Framework para definir infraestructura de AWS en código (TypeScript) |
| **CloudFormation** | Servicio que crea recursos a partir de una plantilla; CDK la genera |
| **CloudWatch** | Métricas, logs y alarmas de AWS |
| **DLM** | Data Lifecycle Manager: crea y borra snapshots de EBS según una política |
| **EBS** | Disco de red de una EC2 |
| **EC2** | Máquinas virtuales de AWS |
| **ECR** | Registro privado de imágenes Docker |
| **Elastic IP** | IP pública fija asociada a una instancia |
| **IAM** | Usuarios, roles y permisos de AWS |
| **`aws login`** | Inicio de sesión de la CLI con las credenciales de la consola; entrega credenciales temporales |
| **IMDSv2** | Versión segura del servicio de metadatos de la instancia |
| **KMS** | Servicio de claves de cifrado |
| **NAT Gateway** | Salida a internet para subredes privadas (caro, aquí no se usa) |
| **OIDC** | Protocolo con el que GitHub demuestra su identidad a AWS sin claves |
| **Parameter Store** | Almacén de configuración y secretos de SSM |
| **Rol IAM** | Conjunto de permisos que una entidad asume con credenciales temporales |
| **Run Command** | Ejecutar scripts en una instancia a través de SSM |
| **S3** | Almacenamiento de objetos (archivos) |
| **Security group** | Firewall de una instancia |
| **Session Manager** | Terminal en la instancia a través de SSM, sin SSH |
| **SNS** | Notificaciones (email, SMS) a partir de un *topic* |
| **SSM** | AWS Systems Manager: gestión de instancias (Session Manager, Run Command, Parameter Store) |
| **Subred pública** | Subred con ruta a internet a través de un Internet Gateway |
| **User data** | Script que una EC2 ejecuta en su primer arranque |
| **VPC** | Red privada virtual dentro de AWS |
