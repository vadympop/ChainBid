import { NextResponse } from "next/server";

const PINATA_UPLOAD_URL = "https://uploads.pinata.cloud/v3/files";
const PINATA_GATEWAY_BASE_URL = "https://gateway.pinata.cloud/ipfs";
const MAX_IMAGE_COUNT = 5;
const ASSET_TYPES = ["Digital", "Physical"] as const;

type AssetType = (typeof ASSET_TYPES)[number];

type PinataUploadResponse = {
  data?: {
    cid?: string;
  };
  error?: string;
  message?: string;
};

type ValidationResult =
  | {
      assetType: AssetType;
      category?: string;
      description: string;
      images: File[];
      name: string;
    }
  | {
      errors: string[];
    };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const isAssetType = (value: string): value is AssetType => ASSET_TYPES.includes(value as AssetType);

const getTextField = (formData: FormData, fieldName: string) => {
  const value = formData.get(fieldName);

  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
};

const validateUploadForm = (formData: FormData): ValidationResult => {
  const errors: string[] = [];
  const name = getTextField(formData, "name");
  const description = getTextField(formData, "description");
  const assetType = getTextField(formData, "assetType");
  const category = getTextField(formData, "category");
  const images = formData.getAll("images").filter((value): value is File => value instanceof File);

  if (!name) {
    errors.push("name is required.");
  }

  if (!description) {
    errors.push("description is required.");
  }

  if (!assetType) {
    errors.push("assetType is required.");
  } else if (!isAssetType(assetType)) {
    errors.push("assetType must be either Digital or Physical.");
  }

  if (images.length === 0) {
    errors.push("Upload at least one image in the images field.");
  }

  if (images.length > MAX_IMAGE_COUNT) {
    errors.push(`Upload no more than ${MAX_IMAGE_COUNT} images.`);
  }

  for (const [index, image] of images.entries()) {
    if (image.size === 0) {
      errors.push(`images[${index}] is empty.`);
    }

    if (!image.type.startsWith("image/")) {
      errors.push(`images[${index}] must be an image file.`);
    }
  }

  if (errors.length > 0 || !isAssetType(assetType)) {
    return { errors };
  }

  return {
    assetType,
    category: category || undefined,
    description,
    images,
    name,
  };
};

const uploadToPinata = async (file: File, jwt: string, name?: string) => {
  const formData = new FormData();

  formData.append("network", "public");
  formData.append("file", file, file.name);

  if (name) {
    formData.append("name", name);
  }

  const response = await fetch(PINATA_UPLOAD_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
    },
    body: formData,
  });
  const responseBody = (await response.json().catch(() => ({}))) as PinataUploadResponse;
  const cid = responseBody.data?.cid;

  if (!response.ok || !cid) {
    const message = responseBody.error || responseBody.message || "Pinata upload failed.";
    throw new Error(message);
  }

  return cid;
};

export async function POST(request: Request) {
  const pinataJwt = process.env.PINATA_JWT;

  if (!pinataJwt) {
    return NextResponse.json({ error: "PINATA_JWT is not configured on the server." }, { status: 500 });
  }

  if (!request.headers.get("content-type")?.includes("multipart/form-data")) {
    return NextResponse.json({ error: "Request must use multipart/form-data." }, { status: 415 });
  }

  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart/form-data request." }, { status: 400 });
  }

  const validation = validateUploadForm(formData);

  if ("errors" in validation) {
    return NextResponse.json({ error: "Invalid upload metadata.", details: validation.errors }, { status: 400 });
  }

  try {
    const imageCids = await Promise.all(
      validation.images.map((image, index) =>
        uploadToPinata(image, pinataJwt, `${validation.name}-image-${index + 1}`),
      ),
    );
    const imageUris = imageCids.map(cid => `ipfs://${cid}`);
    const metadata = {
      name: validation.name,
      description: validation.description,
      image: imageUris[0],
      images: imageUris,
      attributes: [
        {
          trait_type: "Asset Type",
          value: validation.assetType,
        },
        ...(validation.category
          ? [
              {
                trait_type: "Category",
                value: validation.category,
              },
            ]
          : []),
      ],
    };
    const metadataFile = new File([JSON.stringify(metadata, null, 2)], "metadata.json", {
      type: "application/json",
    });
    const metadataCid = await uploadToPinata(metadataFile, pinataJwt, `${validation.name}-metadata`);
    const metadataUri = `ipfs://${metadataCid}`;

    return NextResponse.json({
      imageUri: imageUris[0],
      imageUris,
      metadataUri,
      gatewayUrl: `${PINATA_GATEWAY_BASE_URL}/${metadataCid}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to upload metadata to Pinata.";

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
