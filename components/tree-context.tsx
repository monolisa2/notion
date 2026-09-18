'use client';

import { createContext, useContext } from 'react';
import type { OrgUnitRow, PageTreeRow } from '@/lib/types';

export const TreeContext = createContext<{ rows: PageTreeRow[]; units: OrgUnitRow[] }>({ rows: [], units: [] });
export const useTree = () => useContext(TreeContext);
