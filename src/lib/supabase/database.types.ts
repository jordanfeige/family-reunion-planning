export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
    Tables: {
      trip: {
        Row: {
          id: string;
          slug: string;
          name: string;
          tagline: string | null;
          destination_notes: string | null;
          target_budget: string | null;
          trip_start: string | null;
          trip_end: string | null;
          proposed_date_slots: string[];
          location_options: Json;
          selected_location_id: string | null;
          selected_weekend_friday: string | null;
          venue_options: Json;
          selected_venue_id: string | null;
          ballot_status: string;
          ballot_opened_at: string | null;
          ballot_closed_at: string | null;
          plan_headcount: number | null;
          itinerary: Json;
          published_itinerary: Json | null;
          share_options_token: string;
          owner_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          tagline?: string | null;
          destination_notes?: string | null;
          target_budget?: string | null;
          trip_start?: string | null;
          trip_end?: string | null;
          proposed_date_slots?: string[];
          location_options?: Json;
          selected_location_id?: string | null;
          selected_weekend_friday?: string | null;
          venue_options?: Json;
          selected_venue_id?: string | null;
          ballot_status?: string;
          ballot_opened_at?: string | null;
          ballot_closed_at?: string | null;
          plan_headcount?: number | null;
          itinerary?: Json;
          published_itinerary?: Json | null;
          share_options_token: string;
          owner_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["trip"]["Insert"]>;
      };
      trip_ballot_vote: {
        Row: {
          id: string;
          trip_id: string;
          option_id: string;
          vote: string;
          survey_response_id: string | null;
          voter_name: string | null;
          voter_email: string | null;
          voter_key: string;
          voted_at: string;
        };
        Insert: {
          id?: string;
          trip_id: string;
          option_id: string;
          vote: string;
          survey_response_id?: string | null;
          voter_name?: string | null;
          voter_email?: string | null;
          voter_key: string;
          voted_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["trip_ballot_vote"]["Insert"]>;
      };
      survey: {
        Row: {
          id: string;
          trip_id: string;
          public_token: string;
          title: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          trip_id: string;
          public_token: string;
          title?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["survey"]["Insert"]>;
      };
      survey_response: {
        Row: {
          id: string;
          survey_id: string;
          respondent_name: string;
          respondent_email: string | null;
          selected_slots: string[];
          selected_locations: string[];
          adult_count: number;
          kid_count: number;
          attendee_count: number;
          notes: string | null;
          submitted_at: string;
        };
        Insert: {
          id?: string;
          survey_id: string;
          respondent_name: string;
          respondent_email?: string | null;
          selected_slots?: string[];
          selected_locations?: string[];
          adult_count?: number;
          kid_count?: number;
          attendee_count?: number;
          notes?: string | null;
          submitted_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["survey_response"]["Insert"]>;
      };
      trip_confirmation: {
        Row: {
          id: string;
          trip_id: string;
          respondent_name: string;
          respondent_email: string | null;
          status: string;
          adult_count: number;
          kid_count: number;
          weekend_friday: string;
          location_id: string;
          submitted_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          trip_id: string;
          respondent_name: string;
          respondent_email?: string | null;
          status: string;
          adult_count?: number;
          kid_count?: number;
          weekend_friday: string;
          location_id: string;
          submitted_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["trip_confirmation"]["Insert"]>;
      };
      trip_option: {
        Row: {
          id: string;
          trip_id: string;
          title: string;
          summary: string | null;
          content_markdown: string;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          trip_id: string;
          title: string;
          summary?: string | null;
          content_markdown: string;
          sort_order?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["trip_option"]["Insert"]>;
      };
      gallery_item: {
        Row: {
          id: string;
          trip_id: string;
          url: string;
          media_type: string;
          caption: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          trip_id: string;
          url: string;
          media_type: string;
          caption?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["gallery_item"]["Insert"]>;
      };
    };
  };
};
