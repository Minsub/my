import { oauthProviderOpenIdConfigMetadata } from "@better-auth/oauth-provider";
import { getAuth } from "@/server/auth";
export async function GET(request: Request) {
  return oauthProviderOpenIdConfigMetadata(getAuth())(request);
}
