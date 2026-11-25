import { lazy, type ComponentType } from 'react'
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom'
import { GuestOnly, RequireAuth, RequireRole } from '@/lib/guards'
import type { Role } from '@/lib/roles'
import { PublicLayout } from './layouts/PublicLayout'
import { RoleLayout } from './layouts/RoleLayout'
import { RootLayout } from './RootLayout'

/** Code-split each page: `page(() => import('...'), 'ExportName')`. */
function page<M extends Record<string, unknown>>(loader: () => Promise<M>, name: keyof M & string) {
  const C = lazy(() => loader().then((m) => ({ default: m[name] as ComponentType })))
  return <C />
}

const landing = () => import('@/features/landing/LandingPage')
const design = () => import('@/features/design/DesignPage')
const auth = () => import('@/features/auth')
const pub = () => import('@/features/public')
const pay = () => import('@/features/payments/SandboxPayPage')
const notifications = () => import('@/features/notifications/NotificationsPage')
const common = () => import('@/features/common/pages')
const status = () => import('@/features/status/StatusPage')
const admin = () => import('@/features/admin')
const driver = () => import('@/features/driver')
const supplier = () => import('@/features/supplier')
const mechanic = () => import('@/features/mechanic')
const tow = () => import('@/features/tow')
const dispatcher = () => import('@/features/dispatcher')
const profile = () => import('@/features/profile/ProfilePage')

function roleArea(role: Role, children: RouteObject[], allowUnapproved = false): RouteObject {
  return {
    element: (
      <RequireRole roles={[role]} allowUnapproved={allowUnapproved}>
        <RoleLayout />
      </RequireRole>
    ),
    children: [
      ...children,
      { path: 'notifications', element: page(notifications, 'NotificationsPage') },
      { path: 'profile', element: page(profile, 'ProfilePage') },
    ],
  }
}

export const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    children: [
      { path: '/', element: page(landing, 'LandingPage') },
      {
        element: <PublicLayout />,
        children: [
          { path: '/parts', element: page(pub, 'PartsCatalogPage') },
          { path: '/parts/:id', element: page(driver, 'PartDetailPage') },
          { path: '/mechanics', element: page(pub, 'MechanicsDirectoryPage') },
          { path: '/mechanics/:id', element: page(pub, 'MechanicProfilePage') },
          { path: '/sos', element: page(pub, 'SosGuestPage') },
          { path: '/track/:id', element: page(pub, 'TrackPage') },
          { path: '/how-it-works', element: page(pub, 'HowItWorksPage') },
          { path: '/help', element: page(pub, 'HelpPage') },
          { path: '/status', element: page(status, 'StatusPage') },
          { path: '/terms', element: page(pub, 'TermsPage') },
          { path: '/privacy', element: page(pub, 'PrivacyPage') },
          { path: '/pay/:token', element: page(pay, 'SandboxPayPage') },
          { path: '/design', element: page(design, 'DesignPage') },
          { path: '/login', element: <GuestOnly>{page(auth, 'LoginPage')}</GuestOnly> },
          { path: '/register', element: <GuestOnly>{page(auth, 'RegisterPage')}</GuestOnly> },
          { path: '/register/verify', element: page(auth, 'VerifyOtpPage') },
          { path: '/forgot-password', element: <GuestOnly>{page(auth, 'ForgotPasswordPage')}</GuestOnly> },
          { path: '/reset-password', element: <GuestOnly>{page(auth, 'ResetPasswordPage')}</GuestOnly> },
          { path: '/account/:state', element: page(auth, 'AccountStatePage') },
          { path: '/pending', element: <RequireAuth>{page(auth, 'PendingApprovalPage')}</RequireAuth> },
        ],
      },
      {
        path: '/app',
        children: [
          { index: true, element: page(common, 'AppHomeRedirect') },
          {
            path: 'driver',
            ...roleArea('DRIVER', [
              { index: true, element: page(driver, 'DriverDashboard') },
              { path: 'parts', element: page(driver, 'PartsSearchPage') },
              { path: 'parts/:id', element: page(driver, 'PartDetailPage') },
              { path: 'cart', element: page(driver, 'CartPage') },
              { path: 'orders', element: page(driver, 'OrdersPage') },
              { path: 'orders/:id', element: page(driver, 'OrderDetailPage') },
              { path: 'mechanics', element: page(driver, 'DriverMechanicsPage') },
              { path: 'mechanics/:id', element: page(driver, 'BookMechanicPage') },
              { path: 'bookings', element: page(driver, 'BookingsPage') },
              { path: 'payments', element: page(driver, 'DriverPaymentsPage') },
              { path: 'sos', element: page(driver, 'SosRequestPage') },
              { path: 'sos/:id', element: page(driver, 'SosTrackingPage') },
            ]),
          },
          {
            path: 'supplier',
            ...roleArea('SUPPLIER', [
              { index: true, element: page(supplier, 'SupplierDashboard') },
              { path: 'offers', element: page(supplier, 'OffersPage') },
              { path: 'orders', element: page(supplier, 'SupplierOrdersPage') },
              { path: 'reviews', element: page(supplier, 'SupplierReviewsPage') },
            ]),
          },
          {
            path: 'mechanic',
            ...roleArea('MECHANIC', [
              { index: true, element: page(mechanic, 'MechanicDashboard') },
              { path: 'requests', element: page(mechanic, 'MechanicRequestsPage') },
              { path: 'schedule', element: page(mechanic, 'MechanicSchedulePage') },
              { path: 'services', element: page(mechanic, 'MechanicServicesPage') },
              { path: 'reviews', element: page(mechanic, 'MechanicReviewsPage') },
              { path: 'garage', element: <Navigate to="../profile" replace /> },
            ]),
          },
          {
            path: 'tow',
            ...roleArea('TOW_DRIVER', [
              { index: true, element: page(tow, 'TowDashboard') },
              { path: 'history', element: page(tow, 'TowHistoryPage') },
            ]),
          },
          {
            path: 'dispatcher',
            ...roleArea('DISPATCHER', [
              { index: true, element: page(dispatcher, 'DispatchBoardPage') },
              { path: 'fleet', element: page(dispatcher, 'FleetPage') },
            ]),
          },
          {
            path: 'admin',
            ...roleArea('ADMIN', [
              { index: true, element: page(admin, 'AdminOverviewPage') },
              { path: 'approvals', element: page(admin, 'ApprovalsPage') },
              { path: 'users', element: page(admin, 'UsersPage') },
              { path: 'moderation', element: page(admin, 'ModerationPage') },
              { path: 'payments', element: page(admin, 'AdminPaymentsPage') },
              { path: 'fleet', element: page(dispatcher, 'FleetPage') },
              { path: 'sms', element: page(admin, 'SmsLogPage') },
              { path: 'reports', element: page(admin, 'ReportsPage') },
              { path: 'settings', element: page(admin, 'SettingsPage') },
            ]),
          },
        ],
      },
      { path: '*', element: page(common, 'NotFoundPage') },
    ],
  },
]

export const router = createBrowserRouter(routes)
