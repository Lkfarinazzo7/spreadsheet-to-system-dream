export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      canais_venda: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          user_id?: string
        }
        Relationships: []
      }
      categorias_plano: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          user_id?: string
        }
        Relationships: []
      }
      comissoes: {
        Row: {
          contrato_id: string
          created_at: string
          data_pagamento: string | null
          id: string
          mes_previsto: string
          observacoes: string | null
          pago: boolean
          parcela: number
          tipo: Database["public"]["Enums"]["tipo_comissao"]
          updated_at: string
          user_id: string
          valor: number
        }
        Insert: {
          contrato_id: string
          created_at?: string
          data_pagamento?: string | null
          id?: string
          mes_previsto: string
          observacoes?: string | null
          pago?: boolean
          parcela?: number
          tipo?: Database["public"]["Enums"]["tipo_comissao"]
          updated_at?: string
          user_id: string
          valor?: number
        }
        Update: {
          contrato_id?: string
          created_at?: string
          data_pagamento?: string | null
          id?: string
          mes_previsto?: string
          observacoes?: string | null
          pago?: boolean
          parcela?: number
          tipo?: Database["public"]["Enums"]["tipo_comissao"]
          updated_at?: string
          user_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "comissoes_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
        ]
      }
      contratos: {
        Row: {
          canal_id: string | null
          categoria_id: string | null
          cliente: string
          created_at: string
          dados_proposta: Json | null
          data_reajuste: string | null
          data_vigencia: string | null
          id: string
          numero_proposta: string | null
          observacoes: string | null
          operadora_id: string | null
          proporcao_comissao: number
          status: Database["public"]["Enums"]["status_contrato"]
          tipo: Database["public"]["Enums"]["tipo_contrato"]
          updated_at: string
          user_id: string
          valor_mensal: number
        }
        Insert: {
          canal_id?: string | null
          categoria_id?: string | null
          cliente: string
          created_at?: string
          dados_proposta?: Json | null
          data_reajuste?: string | null
          data_vigencia?: string | null
          id?: string
          numero_proposta?: string | null
          observacoes?: string | null
          operadora_id?: string | null
          proporcao_comissao?: number
          status?: Database["public"]["Enums"]["status_contrato"]
          tipo?: Database["public"]["Enums"]["tipo_contrato"]
          updated_at?: string
          user_id: string
          valor_mensal?: number
        }
        Update: {
          canal_id?: string | null
          categoria_id?: string | null
          cliente?: string
          created_at?: string
          dados_proposta?: Json | null
          data_reajuste?: string | null
          data_vigencia?: string | null
          id?: string
          numero_proposta?: string | null
          observacoes?: string | null
          operadora_id?: string | null
          proporcao_comissao?: number
          status?: Database["public"]["Enums"]["status_contrato"]
          tipo?: Database["public"]["Enums"]["tipo_contrato"]
          updated_at?: string
          user_id?: string
          valor_mensal?: number
        }
        Relationships: [
          {
            foreignKeyName: "contratos_canal_id_fkey"
            columns: ["canal_id"]
            isOneToOne: false
            referencedRelation: "canais_venda"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_plano"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_operadora_id_fkey"
            columns: ["operadora_id"]
            isOneToOne: false
            referencedRelation: "operadoras"
            referencedColumns: ["id"]
          },
        ]
      }
      despesas: {
        Row: {
          categoria: string | null
          created_at: string
          data: string
          data_pagamento: string | null
          descricao: string
          id: string
          observacoes: string | null
          pago: boolean
          updated_at: string
          user_id: string
          valor: number
        }
        Insert: {
          categoria?: string | null
          created_at?: string
          data?: string
          data_pagamento?: string | null
          descricao: string
          id?: string
          observacoes?: string | null
          pago?: boolean
          updated_at?: string
          user_id: string
          valor?: number
        }
        Update: {
          categoria?: string | null
          created_at?: string
          data?: string
          data_pagamento?: string | null
          descricao?: string
          id?: string
          observacoes?: string | null
          pago?: boolean
          updated_at?: string
          user_id?: string
          valor?: number
        }
        Relationships: []
      }
      operadoras: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          user_id?: string
        }
        Relationships: []
      }
      pipeline_contratos: {
        Row: {
          canal_id: string | null
          cliente: string
          created_at: string
          dados_proposta: Json | null
          data_revisao: string | null
          data_vigencia: string | null
          declinada: boolean
          declinada_em: string | null
          etapa: Database["public"]["Enums"]["etapa_pipeline"]
          id: string
          motivo_declinio: string | null
          numero_proposta: string | null
          observacoes: string | null
          operadora_id: string | null
          posicao: number
          tipo: Database["public"]["Enums"]["tipo_contrato"]
          updated_at: string
          user_id: string
          valor_mensal: number
        }
        Insert: {
          canal_id?: string | null
          cliente: string
          created_at?: string
          dados_proposta?: Json | null
          data_revisao?: string | null
          data_vigencia?: string | null
          declinada?: boolean
          declinada_em?: string | null
          etapa?: Database["public"]["Enums"]["etapa_pipeline"]
          id?: string
          motivo_declinio?: string | null
          numero_proposta?: string | null
          observacoes?: string | null
          operadora_id?: string | null
          posicao?: number
          tipo?: Database["public"]["Enums"]["tipo_contrato"]
          updated_at?: string
          user_id: string
          valor_mensal?: number
        }
        Update: {
          canal_id?: string | null
          cliente?: string
          created_at?: string
          dados_proposta?: Json | null
          data_revisao?: string | null
          data_vigencia?: string | null
          declinada?: boolean
          declinada_em?: string | null
          etapa?: Database["public"]["Enums"]["etapa_pipeline"]
          id?: string
          motivo_declinio?: string | null
          numero_proposta?: string | null
          observacoes?: string | null
          operadora_id?: string | null
          posicao?: number
          tipo?: Database["public"]["Enums"]["tipo_contrato"]
          updated_at?: string
          user_id?: string
          valor_mensal?: number
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_contratos_canal_id_fkey"
            columns: ["canal_id"]
            isOneToOne: false
            referencedRelation: "canais_venda"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_contratos_operadora_id_fkey"
            columns: ["operadora_id"]
            isOneToOne: false
            referencedRelation: "operadoras"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      etapa_pipeline:
        | "Montagem de contrato"
        | "Assinatura / Declaração de saúde"
        | "Entrevista médica"
        | "Em análise"
        | "Pendências"
        | "Aguardando vigência"
        | "Implantado"
      status_contrato: "Ativo" | "Cancelado" | "Pendente"
      tipo_comissao: "Bancaria" | "Vida" | "Adesao"
      tipo_contrato: "PJ" | "PF" | "Adesao"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      etapa_pipeline: [
        "Montagem de contrato",
        "Assinatura / Declaração de saúde",
        "Entrevista médica",
        "Em análise",
        "Pendências",
        "Aguardando vigência",
        "Implantado",
      ],
      status_contrato: ["Ativo", "Cancelado", "Pendente"],
      tipo_comissao: ["Bancaria", "Vida", "Adesao"],
      tipo_contrato: ["PJ", "PF", "Adesao"],
    },
  },
} as const
