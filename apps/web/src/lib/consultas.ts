import { useQuery } from '@tanstack/react-query';
import { fetchTramo, fetchTramos } from './api';

export const useTramos = () => useQuery({ queryKey: ['tramos'], queryFn: fetchTramos });

export const useTramo = (slug: string) => useQuery({ queryKey: ['tramos', slug], queryFn: () => fetchTramo(slug) });
