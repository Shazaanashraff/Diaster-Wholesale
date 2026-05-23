import { supabase } from '../lib/supabase';

export interface Salesperson {
  id: string;
  name: string;
  active: boolean;
}

export const getSalespeople = async (): Promise<Salesperson[]> => {
  const { data, error } = await supabase
    .from('salespeople')
    .select('id, name, active')
    .eq('active', true)
    .order('name', { ascending: true });

  if (error) throw error;
  return (data ?? []) as Salesperson[];
};

export const addSalesperson = async (name: string): Promise<Salesperson> => {
  const { data, error } = await supabase
    .from('salespeople')
    .insert({ name: name.trim() })
    .select('id, name, active')
    .single();

  if (error) throw error;
  return data as Salesperson;
};

export const deactivateSalesperson = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('salespeople')
    .update({ active: false })
    .eq('id', id);

  if (error) throw error;
};
