import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { pages, pageComponents } from '@/data/pages-loader'

declare module 'vue-router' {
  interface RouteMeta {
    title?: string
    description?: string
  }
}

const HomePage = () => import('@/views/HomePage.vue')
const NotFound = () => import('@/views/NotFound.vue')

const DEFAULT_TITLE = 'vibe.j2team.org - J2TEAM Community Vibe Coding'
const DEFAULT_DESCRIPTION =
  'Cả nhóm J2TEAM Community vibe code cùng nhau! Mỗi thành viên tạo một trang con, vibe code thoải mái.'

const pageRoutes: RouteRecordRaw[] = pages.map((page) => {
  const componentPath = `/src/views${page.path}/index.vue`
  const loader = pageComponents[componentPath]
  if (!loader) {
    console.warn(`[router] No component found for page "${page.name}" at ${componentPath}`)
  }
  return {
    path: page.path,
    name: page.path.slice(1),
    component: loader ? () => loader() : NotFound,
    meta: {
      title: `${page.name} - vibe.j2team.org`,
      description: page.description,
    },
  }
})

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomePage,
      meta: {
        title: DEFAULT_TITLE,
        description: DEFAULT_DESCRIPTION,
      },
    },
    ...pageRoutes,
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: NotFound,
      meta: {
        title: '404 - Không tìm thấy trang | vibe.j2team.org',
        description: 'Trang bạn tìm không tồn tại.',
      },
    },
  ],
})

router.afterEach((to) => {
  document.title = to.meta.title || DEFAULT_TITLE

  const descriptionEl = document.querySelector('meta[name="description"]')
  if (descriptionEl) {
    descriptionEl.setAttribute('content', to.meta.description || DEFAULT_DESCRIPTION)
  }
})

export default router
