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

  // NOTE: This seed creates the base format catalog (sizes/aspect-ratios).
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
  // Catálogo de tamaños de puzzle. El sync de Shopify cruza el `option1` de
  // cada variante contra `shopifyVariantOption` (sin distinguir mayúsculas ni
  // espacios) para crear los ProductFormatVariant.
  //
  // Dos pares de dimensiones, deliberadamente separados:
  //   width/height          → PÍXELES de la imagen a generar (~1 MP). fal.ai
  //                           solo recibe `aspectRatio`; esto es informativo.
  //   printWidthCm/HeightCm → tamaño físico del puzzle armado. Es lo que
  //                           gobierna el DPI en el estudio de impresión.
  //
  // Un único aspect ratio (4:3) en todos los tamaños a propósito: así el mismo
  // arte generado sirve para cualquier número de piezas y el cliente puede
  // cambiar de tamaño sin regenerar.
  console.log('🧩 Creating puzzle formats...');

  const formatsData = [
    {
      name: 'puzzle_300',
      displayName: '300 pieces',
      aspectRatio: '4:3',
      width: 1184, height: 888,
      printWidthCm: 40, printHeightCm: 30,
      pieceCount: 300,
      shopifyVariantOption: '300 pieces',
    },
    {
      name: 'puzzle_500',
      displayName: '500 pieces',
      aspectRatio: '4:3',
      width: 1184, height: 888,
      printWidthCm: 48, printHeightCm: 36,
      pieceCount: 500,
      shopifyVariantOption: '500 pieces',
    },
    {
      name: 'puzzle_1000',
      displayName: '1000 pieces',
      aspectRatio: '4:3',
      width: 1184, height: 888,
      printWidthCm: 68, printHeightCm: 51,
      pieceCount: 1000,
      shopifyVariantOption: '1000 pieces',
    },
    // Catch-all para productos Shopify de una sola variante (packs de crédito):
    // Shopify llama "Default Title" a su variante placeholder.
    {
      name: 'default_title',
      displayName: 'Default 4:3',
      aspectRatio: '4:3',
      width: 1184, height: 888,
      shopifyVariantOption: 'Default Title',
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
  // PRODUCT FORMAT VARIANT CONSTRAINTS
  // ============================================
  // Sets per-(product, format) generation overrides on existing variants created
  // by the Shopify sync. Safe to re-run: updateMany is idempotent.
  //
  // cropMode  → pista de encuadre para el prompt ('head-shoulders' | 'portrait' | 'full-body')
  // maxPets   → número máximo de mascotas en la composición
  // bleedMm   → sangre de troquelado (la del `printConfig` manda si está puesta)
  //
  // Cuantas más piezas, más grande el puzzle y más cuerpo cabe en el encuadre.
  console.log('🖼️  Seeding product format variant constraints...');

  const variantConstraints: {
    productHandle: string;
    formatName: string;
    constraints: Record<string, unknown>;
  }[] = [
    { productHandle: 'custom-pet-puzzle', formatName: 'puzzle_300',
      constraints: { cropMode: 'head-shoulders', maxPets: 1, bleedMm: 5 } },
    { productHandle: 'custom-pet-puzzle', formatName: 'puzzle_500',
      constraints: { cropMode: 'portrait', maxPets: 2, bleedMm: 5 } },
    { productHandle: 'custom-pet-puzzle', formatName: 'puzzle_1000',
      constraints: { cropMode: 'full-body', maxPets: 2, bleedMm: 5 } },
  ];

  let constraintsUpdated = 0;
  let constraintsSkipped = 0;

  for (const entry of variantConstraints) {
    const product = await prisma.productReference.findFirst({
      where: { shopifyHandle: entry.productHandle },
    });
    const format = await prisma.format.findFirst({
      where: { name: entry.formatName },
    });

    if (!product || !format) {
      console.warn(
        `  ⚠ Skipping constraints for ${entry.productHandle}/${entry.formatName}: product or format not found`,
      );
      constraintsSkipped++;
      continue;
    }

    const result = await prisma.productFormatVariant.updateMany({
      where: { productRefId: product.id, formatId: format.id },
      data: { constraints: entry.constraints as Prisma.InputJsonValue },
    });

    if (result.count === 0) {
      console.warn(
        `  ⚠ No variant found for ${entry.productHandle}/${entry.formatName}`,
      );
      constraintsSkipped++;
    } else {
      constraintsUpdated++;
    }
  }

  console.log(`  ✓ ${constraintsUpdated} variant constraints updated (${constraintsSkipped} skipped)`);

  console.log('\n✅ Seeding completed successfully!');
  console.log(`   - Styles: ${Object.keys(createdStyles).length}`);
  console.log(`   - Formats: ${formatsData.length}`);
  console.log(`   - Variant constraints: ${constraintsUpdated} updated`);
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
