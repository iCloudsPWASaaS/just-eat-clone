import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white p-8 text-center">
      <h1 className="text-4xl font-bold text-gray-900">Welcome to your app</h1>
      <p className="mt-4 max-w-lg text-lg text-gray-600">
        Your workspace is ready. Sign in to open the sample dashboard, or create an account if you are new.
      </p>
      <div className="mt-8 flex items-center gap-4">
        <Link
          href="/login"
          className="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Sign in
        </Link>
        <Link
          href="/signup"
          className="rounded-md border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          Create account
        </Link>
      </div>
    </main>
  );
}
