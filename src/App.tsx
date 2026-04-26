import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import AppLayout from "./components/layout/AppLayout";
import Dashboard from "./pages/app/Dashboard";
import Contratos from "./pages/app/Contratos";
import Pipeline from "./pages/app/Pipeline";
import Comissoes from "./pages/app/Comissoes";
import Despesas from "./pages/app/Despesas";
import Cadastros from "./pages/app/Cadastros";
import Relatorios from "./pages/app/Relatorios";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
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
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
