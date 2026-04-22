import { LayoutDashboard, FileText, Wallet, Receipt, Bell, BarChart3, Upload, Settings, LogOut, KanbanSquare } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

const main = [
  { title: "Dashboard", url: "/app", icon: LayoutDashboard, end: true },
  { title: "Contratos", url: "/app/contratos", icon: FileText },
  { title: "Pipeline", url: "/app/pipeline", icon: KanbanSquare },
  { title: "Comissões", url: "/app/comissoes", icon: Wallet },
  { title: "Despesas", url: "/app/despesas", icon: Receipt },
  { title: "Alertas", url: "/app/alertas", icon: Bell },
];
const tools = [
  { title: "Relatórios", url: "/app/relatorios", icon: BarChart3 },
  { title: "Importar planilhas", url: "/app/importar", icon: Upload },
  { title: "Cadastros", url: "/app/cadastros", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { signOut, user } = useAuth();
  const loc = useLocation();

  const renderItems = (items: typeof main) =>
    items.map((item) => {
      const active = item.end ? loc.pathname === item.url : loc.pathname.startsWith(item.url);
      return (
        <SidebarMenuItem key={item.title}>
          <SidebarMenuButton asChild>
            <NavLink
              to={item.url}
              end={item.end}
              className={
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/60"
              }
            >
              <item.icon className="h-4 w-4" />
              {!collapsed && <span>{item.title}</span>}
            </NavLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
      );
    });

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="border-b">
        <div className="flex items-center gap-2 px-2 py-3">
          <div
            className="h-8 w-8 rounded-lg flex items-center justify-center text-primary-foreground font-bold"
            style={{ background: "var(--gradient-primary)" }}
          >
            C
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="font-semibold text-sm">Corretor SaaS</span>
              <span className="text-xs text-muted-foreground">Gestão de planos</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Operação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderItems(main)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Ferramentas</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderItems(tools)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t p-2">
        {!collapsed && user && (
          <div className="px-2 py-1 text-xs text-muted-foreground truncate">{user.email}</div>
        )}
        <Button variant="ghost" size="sm" className="justify-start" onClick={signOut}>
          <LogOut className="h-4 w-4" />
          {!collapsed && <span className="ml-2">Sair</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}