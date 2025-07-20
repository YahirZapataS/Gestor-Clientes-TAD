import { createRouter, createWebHistory } from 'vue-router'

import HomeView from '../views/HomeView.vue'
import ClientsView from '../views/ClientsView.vue'
import NewWindowView from '../views/NewWindowView.vue'
import ReportsView from '../views/ReportsView.vue'

const routes = [
    { path: '/', name: 'Home', component: HomeView },
    { path: '/clientes', name: 'Clientes', component: ClientsView },
    { path: '/nueva-venta', name: 'NuevaVenta', component: NewWindowView },
    { path: '/reportes', name: 'Reportes', component: ReportsView },
]

const router = createRouter({
    history: createWebHistory(),
    routes
})

export default router
