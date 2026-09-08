import { oauthProviderAuthServerMetadata } from "@better-auth/oauth-provider";
import { getAuth } from "@/server/auth";
export async function GET(request: Request) {
  return oauthProviderAuthServerMetadata(getAuth())(request);
}
