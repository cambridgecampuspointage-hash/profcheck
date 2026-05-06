import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const demoEnabled = process.env.NEXT_PUBLIC_ENABLE_DEMO_LOGIN === 'true'
  const isDemo = demoEnabled && request.cookies.get('demo-session')?.value === 'true'
  const demoRole = request.cookies.get('demo-role')?.value || 'admin'
  const { pathname } = request.nextUrl

  if (pathname.startsWith('/api/alerts/')) {
    return supabaseResponse
  }

  // DEMO BYPASS
  if (isDemo) {
    if (pathname === '/login' || pathname === '/') {
      const url = request.nextUrl.clone()
      if (demoRole === 'admin') url.pathname = '/admin/dashboard'
      else if (demoRole === 'reception') url.pathname = '/reception/dashboard'
      else url.pathname = '/teacher/dashboard'
      return NextResponse.redirect(url)
    }
    
    // Protect routes based on demo role
    if (pathname.startsWith('/admin') && demoRole !== 'admin') {
      // EXCEPTION: Allow reception to see QR display
      if (demoRole === 'reception' && pathname.startsWith('/admin/qr-display')) {
        return supabaseResponse
      }
      const url = request.nextUrl.clone()
      url.pathname = demoRole === 'reception' ? '/reception/dashboard' : '/teacher/dashboard'
      return NextResponse.redirect(url)
    }

    if (pathname.startsWith('/reception') && demoRole !== 'reception' && demoRole !== 'admin') {
      const url = request.nextUrl.clone()
      url.pathname = demoRole === 'admin' ? '/admin/dashboard' : '/teacher/dashboard'
      return NextResponse.redirect(url)
    }

    if (pathname.startsWith('/teacher') && demoRole !== 'teacher') {
      const url = request.nextUrl.clone()
      url.pathname = demoRole === 'admin' ? '/admin/dashboard' : '/reception/dashboard'
      return NextResponse.redirect(url)
    }

    return supabaseResponse
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Public routes
  const publicPaths = ['/login', '/forgot-password', '/reset-password', '/auth/callback']
  if (publicPaths.some((p) => pathname.startsWith(p))) {
    // If user is already logged in and visiting login, redirect to dashboard
    if (user && (pathname === '/login' || pathname === '/forgot-password')) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      const redirectUrl = profile?.role === 'admin' ? '/admin/dashboard' : '/teacher/dashboard'
      const url = request.nextUrl.clone()
      url.pathname = redirectUrl
      return NextResponse.redirect(url)
    }
    return supabaseResponse
  }

  // If not authenticated, redirect to login
  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Get user role for route protection
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  // Root redirect
  if (pathname === '/') {
    const url = request.nextUrl.clone()
    if (profile?.role === 'admin') url.pathname = '/admin/dashboard'
    else if (profile?.role === 'reception') url.pathname = '/reception/dashboard'
    else url.pathname = '/teacher/dashboard'
    return NextResponse.redirect(url)
  }

  // Admin routes (only admin)
  if (pathname.startsWith('/admin') && profile?.role !== 'admin') {
    // EXCEPTION: Allow reception to see QR display
    if (profile?.role === 'reception' && pathname.startsWith('/admin/qr-display')) {
      return supabaseResponse
    }
    const url = request.nextUrl.clone()
    url.pathname = profile?.role === 'reception' ? '/reception/dashboard' : '/teacher/dashboard'
    return NextResponse.redirect(url)
  }

  // Reception routes (reception or admin)
  if (pathname.startsWith('/reception') && profile?.role !== 'reception' && profile?.role !== 'admin') {
    const url = request.nextUrl.clone()
    url.pathname = profile?.role === 'teacher' ? '/teacher/dashboard' : '/admin/dashboard'
    return NextResponse.redirect(url)
  }

  // Teacher routes (only teacher)
  if (pathname.startsWith('/teacher') && profile?.role !== 'teacher') {
    const url = request.nextUrl.clone()
    url.pathname = profile?.role === 'admin' ? '/admin/dashboard' : '/reception/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
