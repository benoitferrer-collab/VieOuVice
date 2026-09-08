import { AuthForm } from "@/components/auth-form";
export default async function Auth({
  searchParams,
}: {
  searchParams: Promise<{ recovery?: string; error?: string }>;
}) {
  const params = await searchParams;
  return (
    <>
      <AuthForm recovery={params.recovery === "1"} />
      {params.error && (
        <p role="alert" className="auth-page coral">
          Le lien a expiré ou n’est plus valide. Demande un nouveau lien.
        </p>
      )}
    </>
  );
}
