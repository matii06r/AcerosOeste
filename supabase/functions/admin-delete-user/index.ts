// @ts-ignore -- Las Edge Functions resuelven imports URL mediante Deno.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") || "";
  const configuredSite = Deno.env.get("SITE_URL") || "https://acerosoeste.com";
  let siteOrigin = "https://acerosoeste.com";
  try {
    siteOrigin = new URL(configuredSite).origin;
  } catch {
    // Se conserva el dominio productivo si SITE_URL no es válido.
  }
  const cors = {
    "Access-Control-Allow-Origin": origin === siteOrigin ? origin : siteOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    Vary: "Origin",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const token = (req.headers.get("Authorization") || "").replace(
      "Bearer ",
      "",
    );
    const { data: authData, error: authError } =
      await supabase.auth.getUser(token);
    if (authError || !authData.user) throw new Error("Sesión inválida");

    const { data: requester } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", authData.user.id)
      .single();
    if (requester?.role !== "admin") throw new Error("Acceso denegado");

    const { userId } = await req.json();
    if (!userId || typeof userId !== "string")
      throw new Error("Usuario inválido");
    if (userId === authData.user.id)
      throw new Error("No podés eliminar tu propia cuenta administradora");

    const { data: targetProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();
    if (targetProfile?.role === "admin")
      throw new Error("No se puede eliminar otra cuenta administradora");

    const { error: deleteError } = await supabase.auth.admin.deleteUser(
      userId,
      false,
    );
    if (deleteError) throw deleteError;

    return Response.json({ deleted: true, userId }, { headers: cors });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Error interno" },
      { status: 400, headers: cors },
    );
  }
});
