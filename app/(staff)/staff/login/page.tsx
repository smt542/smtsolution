import { LoginForm } from "./components/LoginForm";

export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-6 px-6">
      <div>
        <h1 className="text-2xl font-extrabold">로그인</h1>
        <p className="mt-1.5 text-sm text-gray-400">발급받은 계정으로 로그인해 주세요.</p>
      </div>
      <LoginForm />
      <p className="text-center text-xs text-gray-400">계정 문의는 마스터 관리자에게 요청해 주세요.</p>
    </div>
  );
}
