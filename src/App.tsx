import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import AppLayout from "./components/layout/AppLayout";

const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Dashboard = lazy(() => import("./pages/app/Dashboard"));
const Contratos = lazy(() => import("./pages/app/Contratos"));
const Pipeline = lazy(() => import("./pages/app/Pipeline"));
const Comissoes = lazy(() => import("./pages/app/Comissoes"));
const Despesas = lazy(() => import("./pages/app/Despesas"));
const Cadastros = lazy(() => import("./pages/app/Cadastros"));
const Relatorios = lazy(() => import("./pages/app/Relatorios"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<div className="min-h-screen grid place-items-center text-sm text-muted-foreground">Carregando…</div>}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/app" element={<AppLayout />}>
                <Route index element={<Dashboard />} />
                <Route path="contratos" element={<Contratos />} />
                <Route path="pipeline" element={<Pipeline />} />
                <Route path="comissoes" element={<Comissoes />} />
                <Route path="despesas" element={<Despesas />} />
                <Route path="relatorios" element={<Relatorios />} />
                <Route path="cadastros" element={<Cadastros />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
