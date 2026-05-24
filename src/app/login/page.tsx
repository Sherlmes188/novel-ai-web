import { redirect } from "next/navigation";
import { loginAction } from "@/lib/actions";
import { getSession } from "@/lib/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await getSession()) redirect("/novels");
  const params = await searchParams;

  return (
    <main className="grid min-h-screen place-items-center px-4">
      <form action={loginAction} className="panel grid w-full max-w-sm gap-4 p-6">
        <div>
          <h1 className="text-2xl font-black">登录创作后台</h1>
          <p className="muted mt-1 text-sm">个人自用后台，所有 AI 调用都在服务端完成。</p>
        </div>
        {params.error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">账号或密码不正确。</div> : null}
        <label className="field">
          <span className="label">用户名</span>
          <input className="input" name="username" autoComplete="username" required />
        </label>
        <label className="field">
          <span className="label">密码</span>
          <input className="input" type="password" name="password" autoComplete="current-password" required />
        </label>
        <button className="btn" type="submit">登录</button>
      </form>
    </main>
  );
}
