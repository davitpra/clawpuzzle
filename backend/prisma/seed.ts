import 'dotenv/config';
import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  DEFAULT_PROMPT_TEMPLATE,
  DEFAULT_VISION_MAX_TOKENS,
  DEFAULT_VISION_SYSTEM_PROMPT,
} from '../src/vision-configs/vision-configs.constants';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Seeding database...');

  // NOTE: This seed creates the base format catalog (aspect ratios).
  // ProductFormatVariants and ProductReferences are still managed by the Shopify
  // sync service. Product types are a string column on ProductReference, synced
  // from Shopify on upsert.

  // ============================================
  // STYLES
  // ============================================
  console.log('🎨 Creating styles...');

  // Seed a default ImageGenConfig and VisionConfig used by all seed styles
  const defaultImageGenConfig = await prisma.imageGenConfig.upsert({
    where: { name: 'flux-dev-default' },
    update: {},
    create: {
      name: 'flux-dev-default',
      description: 'Default Fal.ai Flux Dev configuration',
      model: 'fal-ai/flux/dev',
      parameters: { num_inference_steps: 28 },
    },
  });

  const defaultVisionConfig = await prisma.visionConfig.upsert({
    where: { name: 'gemini-flash-default' },
    update: {},
    create: {
      name: 'gemini-flash-default',
      description: 'Default Gemini Flash vision configuration',
      visionModel: 'google/gemini-2.5-flash',
      visionTemperature: 0.7,
      systemPrompt: DEFAULT_VISION_SYSTEM_PROMPT,
      maxTokens: DEFAULT_VISION_MAX_TOKENS,
    },
  });

  console.log('  ✓ Default VisionConfig and ImageGenConfig created');

  const stylesData = [
    {
      name: 'watercolor_portrait',
      displayName: 'Acuarela',
      category: 'classic',
    },
    {
      name: 'neon_glow',
      displayName: 'Neón Brillante',
      category: 'modern',
    },
    {
      name: 'flat_modern_illustration',
      displayName: 'Flat Modern Illustration',
      category: 'elegant',
    },
  ];

  const createdStyles: Record<string, any> = {};

  for (const styleData of stylesData) {
    const style = await prisma.style.upsert({
      where: { name: styleData.name },
      update: {},
      create: {
        name: styleData.name,
        displayName: styleData.displayName,
        category: styleData.category,
        isActive: true,
        strategyKey: 'style-driven-prompt',
        promptTemplate: DEFAULT_PROMPT_TEMPLATE,
        visionConfigId: defaultVisionConfig.id,
        imageGenConfigId: defaultImageGenConfig.id,
      },
    });
    createdStyles[styleData.name] = style;
  }

  console.log(`  ✓ ${Object.keys(createdStyles).length} styles upserted`);

  // ============================================
  // FORMATS
  // ============================================
  // Un formato es la PROPORCIÓN de la imagen a generar, nada más. El número de
  // piezas y el tamaño físico son de la variante de Shopify (su `printConfig`),
  // así que el mismo arte sirve para cualquier tamaño con esa proporción y el
  // cliente puede cambiar de tamaño sin regenerar.
  //
  // Cada producto elige su formato (`ProductReference.formatId`) y el sync de
  // Shopify se lo asigna a todas sus variantes.
  //
  // width/height son PÍXELES de la imagen a generar (~1 MP, múltiplos de 16):
  // se envían a fal.ai como `image_size`. `aspectRatio` es la etiqueta y lo que
  // reciben los modelos que usan `aspect_ratio` en vez de `image_size`.
  //
  // El primero es el formato por defecto: el sync se lo asigna a los productos
  // nuevos de Shopify (el formato activo más antiguo).
  console.log('🧩 Creating formats...');

  const formatsData = [
    {
      name: 'ratio_4_3',
      displayName: '4:3',
      aspectRatio: '4:3',
      width: 1184, height: 888,
    },
    // A3 vertical (29,7 × 42 cm, 1:√2). 848×1200 da 1:1,415; '5:7' es la
    // proporción entera más cercana.
    {
      name: 'a3_portrait',
      displayName: 'A3 vertical',
      aspectRatio: '5:7',
      width: 848, height: 1200,
    },
  ];

  for (const fmt of formatsData) {
    await prisma.format.upsert({
      where: { name: fmt.name },
      update: {},
      create: { ...fmt, isActive: true },
    });
  }

  console.log(`  ✓ ${formatsData.length} formats upserted`);

  // ============================================
  // PRODUCT VARIANT PRINT SPECS
  // ============================================
  // Tamaño físico y overrides de generación por variante, sobre las variantes
  // que ya creó el sync de Shopify. Se identifican por el título de la variante.
  // Idempotente: updateMany.
  //
  // printConfig → tamaño del puzzle armado en cm; gobierna el DPI del estudio de impresión
  // cropMode    → pista de encuadre para el prompt ('head-shoulders' | 'portrait' | 'full-body')
  // maxPets     → número máximo de mascotas en la composición
  // bleedMm     → sangre de troquelado (la del `printConfig` manda si está puesta)
  console.log('🖼️  Seeding product variant print specs...');

  const variantSpecs: {
    productHandle: string;
    variantTitle: string;
    printConfig: Record<string, unknown>;
    constraints: Record<string, unknown>;
  }[] = [
    { productHandle: 'custom-pet-puzzle', variantTitle: '300 pieces',
      printConfig: { widthCm: 40, heightCm: 30, bleedMm: 5 },
      constraints: { cropMode: 'head-shoulders', maxPets: 1, bleedMm: 5 } },
    { productHandle: 'custom-pet-puzzle', variantTitle: '500 pieces',
      printConfig: { widthCm: 48, heightCm: 36, bleedMm: 5 },
      constraints: { cropMode: 'portrait', maxPets: 2, bleedMm: 5 } },
    { productHandle: 'custom-pet-puzzle', variantTitle: '1000 pieces',
      printConfig: { widthCm: 68, heightCm: 51, bleedMm: 5 },
      constraints: { cropMode: 'full-body', maxPets: 2, bleedMm: 5 } },
  ];

  let specsUpdated = 0;
  let specsSkipped = 0;

  for (const entry of variantSpecs) {
    const label = `${entry.productHandle}/${entry.variantTitle}`;
    const product = await prisma.productReference.findFirst({
      where: { shopifyHandle: entry.productHandle },
    });

    if (!product) {
      console.warn(`  ⚠ Skipping ${label}: product not found`);
      specsSkipped++;
      continue;
    }

    const result = await prisma.productFormatVariant.updateMany({
      where: { productRefId: product.id, shopifyVariantTitle: entry.variantTitle },
      data: {
        printConfig: entry.printConfig as Prisma.InputJsonValue,
        constraints: entry.constraints as Prisma.InputJsonValue,
      },
    });

    if (result.count === 0) {
      console.warn(`  ⚠ No variant found for ${label}`);
      specsSkipped++;
    } else {
      specsUpdated++;
    }
  }

  console.log(`  ✓ ${specsUpdated} variant print specs updated (${specsSkipped} skipped)`);

  console.log('\n✅ Seeding completed successfully!');
  console.log(`   - Styles: ${Object.keys(createdStyles).length}`);
  console.log(`   - Formats: ${formatsData.length}`);
  console.log(`   - Variant print specs: ${specsUpdated} updated`);
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
