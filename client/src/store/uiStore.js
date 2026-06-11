import { create } from 'zustand';

export const useUiStore = create((set) => ({
  sidebarCollapsed: localStorage.getItem('sidebar_collapsed') === 'true',
  activeVertical: null,
  activeSubVertical: null,
  assignedSubVerticals: [],
  
  toggleSidebar: () => set((state) => {
    const nextVal = !state.sidebarCollapsed;
    localStorage.setItem('sidebar_collapsed', String(nextVal));
    return { sidebarCollapsed: nextVal };
  }),
  
  setSidebarCollapsed: (collapsed) => {
    localStorage.setItem('sidebar_collapsed', String(collapsed));
    set({ sidebarCollapsed: collapsed });
  },

  setActiveVertical: (vertical) => set({ activeVertical: vertical }),
  setActiveSubVertical: (subVertical) => set({ activeSubVertical: subVertical }),
  setAssignedSubVerticals: (assignments) => set({ assignedSubVerticals: assignments }),
  
  leadsRefreshTrigger: 0,
  triggerLeadsRefresh: () => set((state) => ({ leadsRefreshTrigger: state.leadsRefreshTrigger + 1 }))
}));

export default useUiStore;
