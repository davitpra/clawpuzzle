"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import {
  Page,
  Layout,
  Card,
  Badge,
  Button,
  Banner,
  Spinner,
  Text,
  InlineStack,
  BlockStack,
  Box,
  Divider,
  Modal,
  TextField,
  Select,
  FormLayout,
  Collapsible,
} from "@shopify/polaris";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import {
  adminApi,
  AdminStyle,
  AdminStyleImage,
  AdminImageGeneration,
  AdminVisionConfig,
  AdminImageGenConfig,
  AdminPet,
  AdminFormat,
} from "@/entities/admin/api";
import { useAdminGenerationStatus } from "@/hooks/useAdminGenerationStatus";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { hexToHsb, type HsbColor } from "@/lib/colorUtils";
import {
  UNASSIGNED,
  type TemplateVarOption,
  EXAMPLE_TEMPLATE_VARS,
  EXAMPLE_TEMPLATE_VAR_OPTIONS,
  validateTemplateVarOptions,
} from "./templateVars";
import {
  StyleTestGenerationCard,
  FORMAT_PREFIX,
} from "./_components/StyleTestGenerationCard";
import { StyleImageViewerModal } from "./_components/StyleImageViewerModal";
import { SortableImageTile, UploadTile } from "./_components/StyleImageTiles";
import { CategoryField } from "./_components/CategoryField";
import { UnsavedChangesModal } from "./_components/UnsavedChangesModal";

type StyleDifficulty = NonNullable<AdminStyle["difficulty"]>;

// Valores del formulario tal como los muestra la página para un estilo guardado.
// Sirve para hidratar el formulario y para detectar cambios sin guardar.
function formValuesFrom(s: AdminStyle) {
  return {
    name: s.name,
    displayName: s.displayName,
    category: s.category,
    difficulty: (s.difficulty ?? "medium") as StyleDifficulty,
    strategyKey: s.strategyKey ?? "",
    visionConfigId: s.visionConfigId ?? UNASSIGNED,
    imageGenConfigId: s.imageGenConfigId ?? UNASSIGNED,
    promptTemplate: s.promptTemplate ?? "",
    templateVarsText: s.templateVars
      ? JSON.stringify(s.templateVars, null, 2)
      : "",
    templateVarOptionsText: s.templateVarOptions
      ? JSON.stringify(s.templateVarOptions, null, 2)
      : "",
  };
}

export default function AdminStyleDetailPage() {
  const { id } = useParams<{ id: string }>();

  const [style, setStyle] = useState<AdminStyle | null>(null);
  const [visionConfigs, setVisionConfigs] = useState<AdminVisionConfig[]>([]);
  const [imageGenConfigs, setImageGenConfigs] = useState<AdminImageGenConfig[]>(
    [],
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);
  const [duplicating, setDuplicating] = useState(false);

  // Sidebar form state
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [category, setCategory] = useState("");
  // Categorías que ya usan los demás estilos, para sugerirlas en el campo.
  const [categories, setCategories] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState<StyleDifficulty>("medium");

  // Pipeline form state
  const [strategyKey, setStrategyKey] = useState("");
  const [strategyKeys, setStrategyKeys] = useState<string[]>([]);
  const [visionConfigId, setVisionConfigId] = useState<string>(UNASSIGNED);
  const [imageGenConfigId, setImageGenConfigId] = useState<string>(UNASSIGNED);

  // Prompt template form state
  const [promptTemplate, setPromptTemplate] = useState("");
  const [templateVarsText, setTemplateVarsText] = useState("");
  const [templateVarOptionsText, setTemplateVarOptionsText] = useState("");
  // Sin uso en el lanzamiento: plegada salvo que el estilo ya tenga opciones.
  const [templateVarsOpen, setTemplateVarsOpen] = useState(false);
  const [jsonPromptError, setJsonPromptError] = useState<string | null>(null);
  const [jsonOptionsError, setJsonOptionsError] = useState<string | null>(null);

  // Reference image state (style-transfer strategy)
  const [uploadingRefImage, setUploadingRefImage] = useState(false);
  const [removingRefImage, setRemovingRefImage] = useState(false);
  const refImageInputRef = useRef<HTMLInputElement>(null);

  // Image state
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageActionId, setImageActionId] = useState<string | null>(null);
  const [deletingImage, setDeletingImage] = useState<AdminStyleImage | null>(
    null,
  );
  const [reorderingImages, setReorderingImages] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Image viewer state
  const [viewingImage, setViewingImage] = useState<AdminStyleImage | null>(
    null,
  );
  const [viewerAlt, setViewerAlt] = useState("");
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [imageGeneration, setImageGeneration] =
    useState<AdminImageGeneration | null>(null);
  const [imageGenerationLoading, setImageGenerationLoading] = useState(false);
  const [imageGenerationError, setImageGenerationError] = useState<
    string | null
  >(null);
  const [imageGenerationNotFound, setImageGenerationNotFound] = useState(false);
  const [copiedFinalPrompt, setCopiedFinalPrompt] = useState(false);
  const [metadataOpen, setMetadataOpen] = useState(false);

  // Test generation state
  const [testGenId, setTestGenId] = useState<string | null>(null);
  const [testGenRunning, setTestGenRunning] = useState(false);
  const [testGenError, setTestGenError] = useState<string | null>(null);
  const [testGenSuccess, setTestGenSuccess] = useState(false);
  // Valor del select de formato: un aspect ratio ("4:5") o un formato del
  // catálogo con prefijo FORMAT_PREFIX ("format:<id>").
  const [testAspectRatio, setTestAspectRatio] = useState("4:5");
  const [formats, setFormats] = useState<AdminFormat[]>([]);
  const [userSelections, setUserSelections] = useState<
    Record<string, string | number>
  >({});
  const [colorHsbs, setColorHsbs] = useState<Record<string, HsbColor>>({});
  const [colorPopovers, setColorPopovers] = useState<Record<string, boolean>>(
    {},
  );
  // Pet gallery state
  const [myPets, setMyPets] = useState<AdminPet[]>([]);
  const [petsLoading, setPetsLoading] = useState(false);
  const [selectedPetId, setSelectedPetId] = useState<string>("");
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [newPetModalOpen, setNewPetModalOpen] = useState(false);
  const [newPetName, setNewPetName] = useState("");
  const [newPetSpecies, setNewPetSpecies] = useState("dog");
  const [newPetBreed, setNewPetBreed] = useState("");
  const [creatingPet, setCreatingPet] = useState(false);
  const [createPetError, setCreatePetError] = useState<string | null>(null);
  const [uploadingPetPhoto, setUploadingPetPhoto] = useState(false);
  const [deletingPetPhotoId, setDeletingPetPhotoId] = useState<string | null>(
    null,
  );
  const petPhotoInputRef = useRef<HTMLInputElement>(null);

  const testGenStatus = useAdminGenerationStatus(testGenId);

  const saved = style ? formValuesFrom(style) : null;
  const isDirty =
    !!saved &&
    (name !== saved.name ||
      displayName !== saved.displayName ||
      category !== saved.category ||
      difficulty !== saved.difficulty ||
      strategyKey !== saved.strategyKey ||
      visionConfigId !== saved.visionConfigId ||
      imageGenConfigId !== saved.imageGenConfigId ||
      promptTemplate !== saved.promptTemplate ||
      templateVarsText !== saved.templateVarsText ||
      templateVarOptionsText !== saved.templateVarOptionsText);

  const leaveGuard = useUnsavedChangesGuard(isDirty);

  const dndSensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const hydrateForm = useCallback((s: AdminStyle) => {
    const v = formValuesFrom(s);
    setName(v.name);
    setNameError(null);
    setDisplayName(v.displayName);
    setCategory(v.category);
    setDifficulty(v.difficulty);
    setStrategyKey(v.strategyKey);
    setVisionConfigId(v.visionConfigId);
    setImageGenConfigId(v.imageGenConfigId);
    setPromptTemplate(v.promptTemplate);
    setTemplateVarsText(v.templateVarsText);
    setTemplateVarOptionsText(v.templateVarOptionsText);
    const hasKeys = (v: unknown) =>
      !!v && typeof v === "object" && Object.keys(v).length > 0;
    if (hasKeys(s.templateVars) || hasKeys(s.templateVarOptions)) {
      setTemplateVarsOpen(true);
    }
  }, []);

  // Refresca el estilo guardado (imágenes, estado, referencia) sin tocar el
  // formulario, para no pisar cambios que el admin aún no ha guardado.
  const reload = useCallback(async () => {
    const s = await adminApi.styles.getById(id);
    setStyle(s);
  }, [id]);

  useEffect(() => {
    Promise.all([
      adminApi.styles.getById(id),
      adminApi.visionConfigs.list(),
      adminApi.imageGenConfigs.list(),
      adminApi.strategies.list(),
    ])
      .then(([s, vc, igc, sk]) => {
        setStyle(s);
        // No bloquea el editor: sin la lista solo se pierden las sugerencias.
        adminApi.styles
          .list()
          .then((all) =>
            setCategories(
              [...new Set(all.map((x) => x.category.trim()))]
                .filter(Boolean)
                .sort((a, b) => a.localeCompare(b, "es")),
            ),
          )
          .catch(() => {});
        setVisionConfigs(vc);
        setImageGenConfigs(igc);
        setStrategyKeys(sk);
        hydrateForm(s);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id, hydrateForm]);

  const loadPets = async () => {
    setPetsLoading(true);
    try {
      const pets = await adminApi.pets.list();
      setMyPets(pets);
      setSelectedPetId((prev) => (prev ? prev : (pets[0]?.id ?? "")));
      // Preselecciona la primera foto de la mascota inicial, si tiene alguna.
      setSelectedPhotoId((prev) => prev ?? pets[0]?.photos[0]?.id ?? null);
    } catch {
      // silent — pets not critical to page load
    } finally {
      setPetsLoading(false);
    }
  };

  useEffect(() => {
    void loadPets();
  }, []);

  useEffect(() => {
    adminApi.formats
      .list()
      .then((list) => {
        const active = list.filter((f) => f.isActive);
        setFormats(active);
        // Por defecto se prueba con el formato del puzzle de lanzamiento, salvo
        // que el admin ya haya elegido otro mientras cargaba la lista.
        const launchFormat = active.find((f) => f.name === "ratio_2_3");
        if (launchFormat) {
          setTestAspectRatio((prev) =>
            prev === "4:5" ? `${FORMAT_PREFIX}${launchFormat.id}` : prev,
          );
        }
      })
      .catch(() => {
        // silent — sin formatos quedan los aspect ratios fijos
      });
  }, []);

  useEffect(() => {
    if (!style?.templateVarOptions) return;
    setUserSelections((prev) => {
      const next = { ...prev };
      const newHsbs: Record<string, HsbColor> = {};
      for (const [key, raw] of Object.entries(
        style.templateVarOptions as Record<string, unknown>,
      )) {
        const opt = raw as TemplateVarOption;
        if (!(key in next)) {
          next[key] = opt.default as string | number;
          if (opt.type === "color") {
            newHsbs[key] = hexToHsb(opt.default as string);
          }
        }
      }
      if (Object.keys(newHsbs).length > 0) {
        setColorHsbs((prev) => ({ ...newHsbs, ...prev }));
      }
      return next;
    });
  }, [style?.templateVarOptions]);

  useEffect(() => {
    if (testGenStatus.status === "completed") {
      setTestGenRunning(false);
      setTestGenId(null);
      setTestGenSuccess(true);
      reload();
    } else if (testGenStatus.status === "failed") {
      setTestGenRunning(false);
      setTestGenId(null);
      setTestGenError(
        testGenStatus.errorMessage ?? "La generación falló. Revisá los logs.",
      );
    }
  }, [testGenStatus.status, testGenStatus.errorMessage, reload]);

  const updateSelection = (key: string, value: string | number) =>
    setUserSelections((prev) => ({ ...prev, [key]: value }));

  const handleRunTestGeneration = async () => {
    if (!style || !selectedPhotoId) return;
    setTestGenError(null);
    setTestGenSuccess(false);
    setTestGenRunning(true);
    try {
      const formatId = testAspectRatio.startsWith(FORMAT_PREFIX)
        ? testAspectRatio.slice(FORMAT_PREFIX.length)
        : undefined;
      const result = await adminApi.styles.runTestGeneration(style.id, {
        petPhotoId: selectedPhotoId,
        ...(formatId
          ? { formatId }
          : { aspectRatio: testAspectRatio || undefined }),
        userSelections,
      });
      setTestGenId(result.generationId);
    } catch (err: unknown) {
      setTestGenRunning(false);
      setTestGenError((err as Error).message);
    }
  };

  const handleUploadPetPhoto = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file || !selectedPetId) return;
    e.target.value = "";
    setUploadingPetPhoto(true);
    try {
      const photo = await adminApi.pets.uploadPhoto(selectedPetId, file);
      setMyPets((prev) =>
        prev.map((p) =>
          p.id === selectedPetId ? { ...p, photos: [...p.photos, photo] } : p,
        ),
      );
      setSelectedPhotoId(photo.id);
    } catch (err: unknown) {
      setTestGenError((err as Error).message);
    } finally {
      setUploadingPetPhoto(false);
    }
  };

  const handleDeletePetPhoto = async (photoId: string) => {
    if (!selectedPetId) return;
    setDeletingPetPhotoId(photoId);
    try {
      await adminApi.pets.deletePhoto(selectedPetId, photoId);
      setMyPets((prev) =>
        prev.map((p) =>
          p.id === selectedPetId
            ? { ...p, photos: p.photos.filter((ph) => ph.id !== photoId) }
            : p,
        ),
      );
      if (selectedPhotoId === photoId) setSelectedPhotoId(null);
    } catch (err: unknown) {
      setTestGenError((err as Error).message);
    } finally {
      setDeletingPetPhotoId(null);
    }
  };

  const handleCreatePet = async () => {
    if (!newPetName.trim()) return;
    setCreatingPet(true);
    setCreatePetError(null);
    try {
      const pet = await adminApi.pets.create({
        name: newPetName.trim(),
        species: newPetSpecies,
        breed: newPetBreed.trim() || undefined,
      });
      setMyPets((prev) => [pet, ...prev]);
      setSelectedPetId(pet.id);
      setSelectedPhotoId(null);
      setNewPetModalOpen(false);
      setNewPetName("");
      setNewPetBreed("");
      setNewPetSpecies("dog");
    } catch (err: unknown) {
      setCreatePetError((err as Error).message);
    } finally {
      setCreatingPet(false);
    }
  };

  // Devuelve si se guardó, para que el aviso de salida sepa si puede navegar.
  const handleSave = async (): Promise<boolean> => {
    if (!style) return false;
    setSaveError(null);
    setNameError(null);
    setJsonPromptError(null);
    setJsonOptionsError(null);

    // Se valida todo antes de enviar: o se guarda el formulario entero o nada.
    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError("Requerido");
      return false;
    }
    if (!/^[a-z0-9_-]+$/.test(trimmedName)) {
      setNameError("Solo minúsculas, números, '-' y '_'");
      return false;
    }
    if (trimmedName.length > 100) {
      setNameError("Máximo 100 caracteres");
      return false;
    }

    let parsedTemplateVars: Record<string, unknown> | null = null;
    if (templateVarsText.trim()) {
      try {
        parsedTemplateVars = JSON.parse(templateVarsText);
      } catch {
        setJsonPromptError("template_vars: JSON inválido");
        setTemplateVarsOpen(true);
        return false;
      }
    }

    let parsedOptions: Record<string, unknown> | null = null;
    if (templateVarOptionsText.trim()) {
      try {
        parsedOptions = JSON.parse(templateVarOptionsText);
      } catch {
        setJsonOptionsError("template_var_options: JSON inválido");
        setTemplateVarsOpen(true);
        return false;
      }
      const validationError = validateTemplateVarOptions(parsedOptions);
      if (validationError) {
        setJsonOptionsError(`template_var_options: ${validationError}`);
        setTemplateVarsOpen(true);
        return false;
      }
    }

    setSaving(true);
    try {
      if (trimmedName !== style.name) {
        const all = await adminApi.styles.list();
        const duplicate = all.find(
          (s) => s.name === trimmedName && s.id !== style.id,
        );
        if (duplicate) {
          setNameError("Ya existe un estilo con ese slug");
          return false;
        }
      }

      const updated = await adminApi.styles.update(style.id, {
        name: trimmedName !== style.name ? trimmedName : undefined,
        displayName,
        category: category.trim(),
        difficulty,
        strategyKey,
        visionConfigId: visionConfigId || null,
        imageGenConfigId: imageGenConfigId || null,
        promptTemplate,
        templateVars: parsedTemplateVars,
        templateVarOptions: parsedOptions,
      });
      setStyle(updated);
      hydrateForm(updated);
      return true;
    } catch (e: unknown) {
      setSaveError((e as Error).message);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndLeave = async () => {
    if (await handleSave()) leaveGuard.confirmNavigation();
    // Si falla, se cierra el aviso para que se vean los errores del formulario.
    else leaveGuard.cancelNavigation();
  };

  const handleToggle = async () => {
    if (!style) return;
    setToggling(true);
    try {
      if (style.isActive) {
        await adminApi.styles.deactivate(style.id);
      } else {
        await adminApi.styles.update(style.id, { isActive: true });
      }
      await reload();
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setToggling(false);
    }
  };

  const handleDuplicate = async () => {
    if (!style) return;
    setDuplicating(true);
    setSaveError(null);
    try {
      const all = await adminApi.styles.list();
      const taken = new Set(all.map((s) => s.name));
      const base = `${style.name}-copia`;
      let candidate = base;
      let n = 2;
      while (taken.has(candidate)) {
        candidate = `${base}-${n}`;
        n++;
      }
      const created = await adminApi.styles.create({
        name: candidate,
        displayName: `${style.displayName} (copia)`,
        category: style.category,
        strategyKey: style.strategyKey ?? undefined,
        promptTemplate: style.promptTemplate ?? undefined,
        templateVars: style.templateVars ?? undefined,
        templateVarOptions: style.templateVarOptions ?? undefined,
        visionConfigId: style.visionConfigId ?? undefined,
        imageGenConfigId: style.imageGenConfigId ?? undefined,
        isActive: false,
      });
      leaveGuard.requestNavigation(`/admin/styles/${created.id}`);
      setDuplicating(false);
    } catch (e: unknown) {
      setSaveError((e as Error).message ?? "Error al duplicar el estilo");
      setDuplicating(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !style) return;
    e.target.value = "";
    setUploadingImage(true);
    try {
      await adminApi.styles.uploadImage(style.id, file);
      await reload();
    } catch (err: unknown) {
      setSaveError((err as Error).message);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSaveAlt = async (img: AdminStyleImage, value: string) => {
    if (!style) return;
    setImageActionId(img.id);
    try {
      await adminApi.styles.updateImage(style.id, img.id, { altImage: value });
      await reload();
    } catch (err: unknown) {
      setSaveError((err as Error).message);
    } finally {
      setImageActionId(null);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    if (!style) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = style.images.findIndex((img) => img.id === active.id);
    const newIndex = style.images.findIndex((img) => img.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const prevImages = style.images;
    const reordered = arrayMove(prevImages, oldIndex, newIndex).map(
      (img, i) => ({ ...img, orderIndex: i, isPrimary: i === 0 }),
    );

    setStyle((prev) => (prev ? { ...prev, images: reordered } : prev));
    setReorderingImages(true);

    try {
      const styleId = style.id;
      const newPrimary = reordered[0];
      const prevPrimary = prevImages[0];

      if (newPrimary?.id && newPrimary.id !== prevPrimary?.id) {
        await adminApi.styles.updateImage(styleId, newPrimary.id, {
          isPrimary: true,
          orderIndex: 0,
        });
      }

      await Promise.all(
        reordered
          .filter((img, i) => {
            if (!img.id) return false;
            if (img.id === newPrimary?.id) return false;
            const prev = prevImages.find((p) => p.id === img.id);
            return !!prev && prev.orderIndex !== i;
          })
          .map((img) =>
            adminApi.styles.updateImage(styleId, img.id, {
              orderIndex: img.orderIndex,
            }),
          ),
      );

      await reload();
    } catch (err: unknown) {
      setSaveError((err as Error).message);
      await reload();
    } finally {
      setReorderingImages(false);
    }
  };

  const handleDeleteImage = async () => {
    if (!deletingImage || !style) return;
    setImageActionId(deletingImage.id);
    try {
      await adminApi.styles.deleteImage(style.id, deletingImage.id);
      setDeletingImage(null);
      await reload();
    } catch (err: unknown) {
      setSaveError((err as Error).message);
    } finally {
      setImageActionId(null);
    }
  };

  const openViewer = (img: AdminStyleImage) => {
    setViewingImage(img);
    setViewerAlt(img.altImage ?? "");
    setCopiedUrl(false);
  };

  const closeViewer = () => {
    if (imageActionId) return;
    setViewingImage(null);
  };

  useEffect(() => {
    if (!viewingImage) {
      setImageGeneration(null);
      setImageGenerationError(null);
      setImageGenerationNotFound(false);
      setMetadataOpen(false);
      return;
    }
    let cancelled = false;
    setImageGeneration(null);
    setImageGenerationError(null);
    setImageGenerationNotFound(false);
    setImageGenerationLoading(true);
    adminApi.styles
      .getImageGeneration(viewingImage.styleId, viewingImage.id)
      .then((res) => {
        if (cancelled) return;
        setImageGenerationNotFound(res.generation === null);
        setImageGeneration(res.generation);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setImageGenerationError(
          (err as Error).message ?? "Error al cargar generación",
        );
      })
      .finally(() => {
        if (!cancelled) setImageGenerationLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewingImage?.id]);

  const handleViewerSaveAlt = async () => {
    if (!viewingImage) return;
    if (viewerAlt === (viewingImage.altImage ?? "")) return;
    await handleSaveAlt(viewingImage, viewerAlt);
    setViewingImage((prev) => (prev ? { ...prev, altImage: viewerAlt } : prev));
  };

  const handleCopyUrl = async () => {
    if (!viewingImage) return;
    await navigator.clipboard.writeText(viewingImage.imageUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 1500);
  };

  const handleCopyFinalPrompt = async () => {
    const text = imageGeneration?.finalPrompt ?? imageGeneration?.prompt ?? "";
    await navigator.clipboard.writeText(text);
    setCopiedFinalPrompt(true);
    setTimeout(() => setCopiedFinalPrompt(false), 1500);
  };

  if (loading) {
    return (
      <Page
        backAction={{ url: "/admin/styles", content: "Estilos" }}
        title="Cargando…"
      >
        <Box padding="600">
          <InlineStack align="center" gap="300">
            <Spinner />
            <Text as="span" tone="subdued">
              Cargando estilo…
            </Text>
          </InlineStack>
        </Box>
      </Page>
    );
  }

  if (error || !style) {
    return (
      <Page
        backAction={{ url: "/admin/styles", content: "Estilos" }}
        title="Estilo"
      >
        <Banner tone="critical">{error ?? "Estilo no encontrado."}</Banner>
      </Page>
    );
  }

  const visionOptions = [
    { label: "— Sin asignar —", value: UNASSIGNED },
    ...visionConfigs
      .filter((c) => c.isActive || c.id === style.visionConfigId)
      .map((c) => ({
        label: c.isActive ? c.name : `${c.name} (inactivo)`,
        value: c.id,
      })),
  ];

  const imageGenOptions = [
    { label: "— Sin asignar —", value: UNASSIGNED },
    ...imageGenConfigs
      .filter((c) => c.isActive || c.id === style.imageGenConfigId)
      .map((c) => ({
        label: c.isActive ? c.name : `${c.name} (inactivo)`,
        value: c.id,
      })),
  ];

  // Las estrategias style-transfer usan la imagen de referencia; el resto
  // (style-driven, y lo que el backend trate como tal por defecto) usa el VLM.
  const usesReferenceImage = strategyKey.startsWith("style-transfer");

  const strategyOptions = [
    ...strategyKeys.map((k) => ({ label: k, value: k })),
    ...(strategyKey && !strategyKeys.includes(strategyKey)
      ? [{ label: `${strategyKey} (no registrada)`, value: strategyKey }]
      : []),
  ];

  return (
    <Page
      backAction={{ url: "/admin/styles", content: "Estilos" }}
      title={style.displayName}
      subtitle={style.name}
      titleMetadata={
        <Badge tone={style.isActive ? "success" : "enabled"}>
          {style.isActive ? "Activo" : "Inactivo"}
        </Badge>
      }
      primaryAction={{
        content: "Guardar",
        loading: saving,
        disabled: !isDirty || duplicating || toggling,
        onAction: handleSave,
      }}
      secondaryActions={[
        {
          content: "Duplicar",
          loading: duplicating,
          disabled: toggling || saving,
          onAction: handleDuplicate,
        },
        {
          content: style.isActive ? "Desactivar" : "Activar",
          loading: toggling,
          disabled: duplicating || saving,
          onAction: handleToggle,
        },
      ]}
    >
      <Layout>
        {/* Main */}
        <Layout.Section>
          <BlockStack gap="400">
            {saveError && (
              <Banner tone="critical" onDismiss={() => setSaveError(null)}>
                {saveError}
              </Banner>
            )}
            {jsonPromptError && (
              <Banner
                tone="critical"
                onDismiss={() => setJsonPromptError(null)}
              >
                {jsonPromptError}
              </Banner>
            )}
            {jsonOptionsError && (
              <Banner
                tone="critical"
                onDismiss={() => setJsonOptionsError(null)}
              >
                {jsonOptionsError}
              </Banner>
            )}

            <StyleTestGenerationCard
              style={style}
              testGenRunning={testGenRunning}
              testGenStatus={testGenStatus}
              testGenError={testGenError}
              setTestGenError={setTestGenError}
              testGenSuccess={testGenSuccess}
              setTestGenSuccess={setTestGenSuccess}
              myPets={myPets}
              petsLoading={petsLoading}
              selectedPetId={selectedPetId}
              setSelectedPetId={setSelectedPetId}
              selectedPhotoId={selectedPhotoId}
              setSelectedPhotoId={setSelectedPhotoId}
              newPetModalOpen={newPetModalOpen}
              setNewPetModalOpen={setNewPetModalOpen}
              petPhotoInputRef={petPhotoInputRef}
              uploadingPetPhoto={uploadingPetPhoto}
              onUploadPetPhoto={handleUploadPetPhoto}
              deletingPetPhotoId={deletingPetPhotoId}
              onDeletePetPhoto={handleDeletePetPhoto}
              testAspectRatio={testAspectRatio}
              formats={formats}
              setTestAspectRatio={setTestAspectRatio}
              userSelections={userSelections}
              updateSelection={updateSelection}
              colorHsbs={colorHsbs}
              setColorHsbs={setColorHsbs}
              colorPopovers={colorPopovers}
              setColorPopovers={setColorPopovers}
              onRunTestGeneration={handleRunTestGeneration}
              newPetName={newPetName}
              setNewPetName={setNewPetName}
              newPetSpecies={newPetSpecies}
              setNewPetSpecies={setNewPetSpecies}
              newPetBreed={newPetBreed}
              setNewPetBreed={setNewPetBreed}
              creatingPet={creatingPet}
              createPetError={createPetError}
              setCreatePetError={setCreatePetError}
              onCreatePet={handleCreatePet}
            />

            {/* Galería de imágenes */}
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <InlineStack gap="200" blockAlign="center">
                    <Text variant="headingSm" as="h2">
                      Galería de imágenes
                    </Text>
                    <Badge tone="info">{String(style.images.length)}</Badge>
                  </InlineStack>
                  {(uploadingImage || reorderingImages) && (
                    <Spinner size="small" />
                  )}
                </InlineStack>

                <Text as="p" tone="subdued" variant="bodySm">
                  Orden para la landing: 1) Imagen de Gato, 2) Imagen de Perro.
                </Text>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={handleUpload}
                />

                {style.images.length === 0 ? (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(5, 1fr)",
                      gap: 8,
                    }}
                  >
                    <UploadTile
                      uploading={uploadingImage}
                      onClick={() => fileInputRef.current?.click()}
                    />
                  </div>
                ) : (
                  <DndContext
                    sensors={dndSensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={style.images.map((i) => i.id)}
                      strategy={rectSortingStrategy}
                    >
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(5, 1fr)",
                          gap: 8,
                        }}
                      >
                        {style.images.map((img, idx) => (
                          <SortableImageTile
                            key={img.id}
                            img={img}
                            isPrimary={idx === 0}
                            isLoading={
                              imageActionId === img.id || reorderingImages
                            }
                            onView={() => openViewer(img)}
                            onDelete={() => setDeletingImage(img)}
                          />
                        ))}
                        <UploadTile
                          uploading={uploadingImage}
                          onClick={() => fileInputRef.current?.click()}
                        />
                      </div>
                    </SortableContext>
                  </DndContext>
                )}
              </BlockStack>
            </Card>

            {/* Prompt Template */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingSm" as="h2">
                  Prompt Template
                </Text>
                <FormLayout>
                  <TextField
                    label="prompt_template"
                    value={promptTemplate}
                    onChange={setPromptTemplate}
                    multiline={12}
                    autoComplete="off"
                    monospaced
                    helpText="Prompt completo al VLM. Placeholders: {{petName}}, {{petSpecies}}, {{petBreed}}, {{maxPets}} y los de template_vars."
                  />
                </FormLayout>
              </BlockStack>
            </Card>

            {/* Opciones seleccionables por el usuario */}
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="headingSm" as="h2">
                    Opciones de usuario
                  </Text>
                  <Button
                    variant="plain"
                    disclosure={templateVarsOpen ? "up" : "down"}
                    onClick={() => setTemplateVarsOpen((open) => !open)}
                    ariaControls="style-template-vars"
                    ariaExpanded={templateVarsOpen}
                  >
                    {templateVarsOpen ? "Ocultar" : "Mostrar"}
                  </Button>
                </InlineStack>
                <Collapsible open={templateVarsOpen} id="style-template-vars">
                  <BlockStack gap="400">
                    <Text as="p" tone="subdued" variant="bodySm">
                      Variables que el usuario final podrá ajustar al generar la
                      imagen (select / slider / color). Cada key se sustituye en{" "}
                      <code>prompt_template</code> mediante{" "}
                      <code>{"{{key}}"}</code>.
                    </Text>
                    <FormLayout>
                      <TextField
                        label="template_vars (JSON)"
                        value={templateVarsText}
                        onChange={setTemplateVarsText}
                        multiline={6}
                        autoComplete="off"
                        monospaced
                        placeholder={EXAMPLE_TEMPLATE_VARS}
                        helpText=" Posibles Variables custom"
                      />
                      <TextField
                        label="template_var_options (JSON)"
                        value={templateVarOptionsText}
                        onChange={setTemplateVarOptionsText}
                        multiline={10}
                        autoComplete="off"
                        monospaced
                        placeholder={EXAMPLE_TEMPLATE_VAR_OPTIONS}
                        helpText="Cada key define un control: { type: 'select'|'slider'|'color', label, default, ... }"
                      />
                    </FormLayout>
                  </BlockStack>
                </Collapsible>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
        {/* Sidebar */}
        <Layout.Section variant="oneThird">
          <BlockStack gap="200">
            <Card>
              <BlockStack gap="300">
                <Text variant="headingSm" as="h2">
                  Editar
                </Text>
                <FormLayout>
                  <TextField
                    label="Nombre visible"
                    value={displayName}
                    onChange={setDisplayName}
                    autoComplete="off"
                  />
                  <TextField
                    label="Slug"
                    value={name}
                    onChange={(v) => {
                      setName(v);
                      setNameError(null);
                    }}
                    autoComplete="off"
                    error={nameError ?? undefined}
                    maxLength={100}
                    helpText="Solo minúsculas, números, '-' y '_'. Ej: watercolor-classic"
                  />
                  <CategoryField
                    value={category}
                    onChange={setCategory}
                    existing={categories}
                  />
                  {/* anade un select de dificultad: easy, medium, challenging */}
                  {/* <Select
                    label="Dificultad"
                    options={[
                      { label: "Fácil", value: "easy" },
                      { label: "Media", value: "medium" },
                      { label: "Difícil", value: "challenging" },
                    ]}
                    value={difficulty}
                    onChange={(v) => setDifficulty(v as StyleDifficulty)}
                  /> */}
                </FormLayout>

                <Divider />

                <BlockStack gap="100">
                  <Text variant="bodySm" as="span" fontWeight="bold">
                    Creado
                  </Text>
                  <Text as="p" tone="subdued">
                    {new Date(style.createdAt).toLocaleString("es-ES")}
                  </Text>
                </BlockStack>

                {style._count && (
                  <BlockStack gap="100">
                    <Text variant="bodySm" as="span" fontWeight="bold">
                      Uso
                    </Text>
                    <Text as="p" tone="subdued">
                      {style._count.generations} generaciones ·{" "}
                      {style._count.productReferences} productos
                    </Text>
                  </BlockStack>
                )}
              </BlockStack>
            </Card>
            {/* Pipeline (strategy + configs) */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingSm" as="h2">
                  Pipeline
                </Text>

                <FormLayout>
                  <Select
                    label="Estrategia de generacion"
                    options={strategyOptions}
                    value={strategyKey}
                    onChange={setStrategyKey}
                    helpText="Estrategia de pipeline registrada en el backend"
                  />
                  <Select
                    label="Modelos de generación de imagen"
                    options={imageGenOptions}
                    value={imageGenConfigId}
                    onChange={setImageGenConfigId}
                    helpText="Configuración del generador de imagen (FAL u otro)"
                  />
                  <Button
                    size="slim"
                    variant="plain"
                    url="/admin/image-gen-configs"
                  >
                    Gestionar modelos de imagenes →
                  </Button>
                  {usesReferenceImage && (
                    <BlockStack gap="200">
                      <Text variant="bodySm" as="p" fontWeight="bold">
                        Imagen de referencia (style-transfer)
                      </Text>
                      {style.styleReferenceUrl ? (
                        <BlockStack gap="200">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={style.styleReferenceUrl}
                            alt="Referencia de estilo"
                            style={{
                              maxWidth: 160,
                              borderRadius: 8,
                              border: "1px solid #ddd",
                            }}
                          />
                          <InlineStack gap="200">
                            <Button
                              size="slim"
                              loading={uploadingRefImage}
                              onClick={() => refImageInputRef.current?.click()}
                            >
                              Cambiar
                            </Button>
                            <Button
                              size="slim"
                              tone="critical"
                              loading={removingRefImage}
                              onClick={async () => {
                                setRemovingRefImage(true);
                                try {
                                  await adminApi.styles.removeReferenceImage(
                                    id,
                                  );
                                  await reload();
                                } catch (e) {
                                  console.error(e);
                                } finally {
                                  setRemovingRefImage(false);
                                }
                              }}
                            >
                              Eliminar
                            </Button>
                          </InlineStack>
                        </BlockStack>
                      ) : (
                        <Button
                          size="slim"
                          loading={uploadingRefImage}
                          onClick={() => refImageInputRef.current?.click()}
                        >
                          Subir imagen de referencia
                        </Button>
                      )}
                      <Text variant="bodySm" as="p" tone="subdued">
                        Requerida para estrategias de tipo style-transfer.
                        Define el estilo visual, pose y composición.
                      </Text>
                      <input
                        ref={refImageInputRef}
                        type="file"
                        accept="image/*"
                        hidden
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setUploadingRefImage(true);
                          try {
                            await adminApi.styles.uploadReferenceImage(
                              id,
                              file,
                            );
                            await reload();
                          } catch (err) {
                            console.error(err);
                          } finally {
                            setUploadingRefImage(false);
                            e.target.value = "";
                          }
                        }}
                      />
                    </BlockStack>
                  )}

                  {!usesReferenceImage && (
                    <Select
                      label="Modelo de visión (VLM)"
                      options={visionOptions}
                      value={visionConfigId}
                      onChange={setVisionConfigId}
                      helpText="Modelos de analizis la imagen."
                    />
                  )}
                  {!usesReferenceImage && (
                    <Button
                      size="slim"
                      variant="plain"
                      url="/admin/vision-configs"
                    >
                      Gestionar modelos de visión →
                    </Button>
                  )}
                </FormLayout>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>

      <Modal
        open={deletingImage !== null}
        onClose={() => {
          if (!imageActionId) setDeletingImage(null);
        }}
        title="¿Eliminar imagen?"
        primaryAction={{
          content: "Eliminar",
          destructive: true,
          loading: imageActionId !== null,
          onAction: handleDeleteImage,
        }}
        secondaryActions={[
          {
            content: "Cancelar",
            disabled: imageActionId !== null,
            onAction: () => setDeletingImage(null),
          },
        ]}
      >
        <Modal.Section>
          <Text as="p">
            Esta acción eliminará la imagen permanentemente del catálogo y del
            almacenamiento. No se puede deshacer.
          </Text>
        </Modal.Section>
      </Modal>

      <StyleImageViewerModal
        viewingImage={viewingImage}
        onClose={closeViewer}
        viewerAlt={viewerAlt}
        onViewerAltChange={setViewerAlt}
        onViewerSaveAlt={handleViewerSaveAlt}
        onCopyUrl={handleCopyUrl}
        copiedUrl={copiedUrl}
        imageActionId={imageActionId}
        imageGeneration={imageGeneration}
        imageGenerationLoading={imageGenerationLoading}
        imageGenerationError={imageGenerationError}
        imageGenerationNotFound={imageGenerationNotFound}
        onCopyFinalPrompt={handleCopyFinalPrompt}
        copiedFinalPrompt={copiedFinalPrompt}
        metadataOpen={metadataOpen}
        onToggleMetadata={() => setMetadataOpen((prev) => !prev)}
      />

      <UnsavedChangesModal
        open={leaveGuard.pendingHref !== null}
        saving={saving}
        onSave={handleSaveAndLeave}
        onDiscard={leaveGuard.confirmNavigation}
        onCancel={leaveGuard.cancelNavigation}
      />
    </Page>
  );
}
