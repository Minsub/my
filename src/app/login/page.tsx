import { LoginScreen } from "@/components/auth-screens";
import { localPasswordAuth } from "@/server/auth";
export const dynamic = "force-dynamic";
export default function Login() {
  return (
    <LoginScreen
      local={localPasswordAuth()}
      google={Boolean(
        process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
      )}
    />
  );
}
