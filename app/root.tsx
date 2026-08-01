import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";
import type { Route } from "./+types/root";
import { Header } from "~/components/Header";
import { Footer } from "~/components/Footer";
import { CookieBanner } from "~/components/CookieBanner";
import { SITE_TITLE } from "~/lib/site";
import "./app.css";

export const links: Route.LinksFunction = () => [
  { rel: "icon", href: "/favicon.ico" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export function meta() {
  return [
    { title: SITE_TITLE },
    { name: "description", content: "技术博客 · 社区论坛 · 实用在线工具集" },
  ];
}

export default function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <div className="flex-1">
        <Outlet />
      </div>
      <Footer />
      <CookieBanner />
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "页面出错了";
  let details = "";
  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "页面不存在" : `错误 ${error.status}`;
    details = error.statusText || "";
  } else if (error instanceof Error) {
    details = error.message;
  }
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 py-24 text-center">
        <h1 className="text-3xl font-bold text-white">{message}</h1>
        {details && <p className="mt-3 text-muted">{details}</p>}
        <a
          href="/"
          className="mt-8 rounded border border-border px-5 py-2 text-sm text-muted hover:text-white"
        >
          返回首页
        </a>
      </main>
      <Footer />
    </div>
  );
}
