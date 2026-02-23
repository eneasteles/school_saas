import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-neutral-50 px-4 py-10">
      <div className="mx-auto max-w-4xl">
        <div className="rounded-3xl border border-neutral-200 bg-white p-8 shadow sm:p-10">
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
            School SaaS
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-neutral-600 sm:text-base">
            Escolha o tipo de acesso para entrar no sistema.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <Link
              href="/login"
              className="rounded-2xl border border-neutral-200 bg-white p-5 transition hover:bg-neutral-50"
            >
              <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Escola
              </div>
              <div className="mt-1 text-lg font-semibold text-neutral-900">Dono da Escola</div>
              <div className="mt-2 text-sm text-neutral-600">
                Login do tenant para operar alunos, turmas, professores e dashboard da escola.
              </div>
            </Link>

            <Link
              href="/platform/login"
              className="rounded-2xl border border-neutral-900 bg-neutral-900 p-5 text-white transition hover:opacity-95"
            >
              <div className="text-xs font-semibold uppercase tracking-wide text-neutral-300">
                Plataforma
              </div>
              <div className="mt-1 text-lg font-semibold">Admin SaaS</div>
              <div className="mt-2 text-sm text-neutral-200">
                Login global da plataforma para gestão de clientes, cobrança e inadimplência.
              </div>
            </Link>
          </div>

          <div className="mt-8 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-600">
            Após login de Admin SaaS, o acesso segue para{" "}
            <span className="font-mono text-neutral-800">/admin/clients</span> com token de
            plataforma.
          </div>
        </div>
      </div>
    </div>
  );
}
