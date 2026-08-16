import { getPetPackage } from "@/server/blob-store";
import {
  createPackageDownloadHandler,
  writeRequestLog,
} from "@/server/handlers";
import { isPetId } from "@/server/pet-package";

export const runtime = "nodejs";

const handler = createPackageDownloadHandler({
  getPackage: (petId) => getPetPackage(petId),
  isPetId,
  log: writeRequestLog,
});

export async function GET(
  request: Request,
  context: { params: Promise<{ petId: string }> },
) {
  const { petId } = await context.params;
  return handler(request, petId);
}
