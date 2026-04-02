import { Hono } from 'hono'

export const communityRoutes = new Hono()

// Placeholder - will be wired to smart contracts
communityRoutes.get('/', (c) => {
  return c.json({ communities: [], total: 0 })
})

communityRoutes.post('/', async (c) => {
  const body = await c.req.json()
  // TODO: Deploy community contract via CommunityFactory
  return c.json({
    message: 'Community creation initiated',
    name: body.name,
    status: 'pending'
  }, 201)
})
