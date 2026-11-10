import { createContext, useContext } from 'react';

// The signed-in admin ({ me, can(capability) }), provided by AdminApp.
export const AdminContext = createContext(null);

export function useAdmin() {
  return useContext(AdminContext);
}
