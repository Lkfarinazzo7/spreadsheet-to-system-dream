import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

const Index = () => {
  const { user, loading } = useAuth();
  useEffect(() => {
    document.title = "Corretor SaaS — Gestão de planos de saúde";
  }, []);
  if (loading) return null;
  return <Navigate to={user ? "/app" : "/auth"} replace />;
};

export default Index;
