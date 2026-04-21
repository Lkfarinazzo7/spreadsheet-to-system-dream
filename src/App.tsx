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
import Comissoes from "./pages/app/Comissoes";
import Despesas from "./pages/app/Despesas";
import Alertas from "./pages/app/Alertas";
import Cadastros from "./pages/app/Cadastros";
import Relatorios from "./pages/app/Relatorios";
import Importar from "./pages/app/Importar";

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
              <Route path="comissoes" element={<Comissoes />} />
              <Route path="despesas" element={<Despesas />} />
              <Route path="alertas" element={<Alertas />} />
              <Route path="relatorios" element={<Relatorios />} />
              <Route path="importar" element={<Importar />} />
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
