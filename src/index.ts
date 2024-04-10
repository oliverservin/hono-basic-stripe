import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import Stripe from 'stripe'
import 'dotenv/config'
import { HTTPException } from 'hono/http-exception'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

const app = new Hono()

app.post('/checkout', async (c) => {
    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price: 'price_1P3k0pBqHvCog8CcMCQc1Xhu',
                    quantity: 1,
                }
            ],
            mode: 'payment',
            success_url: 'http://localhost:3000/success',
            cancel_url: 'http://localhost:3000/cancel',
        })

        return c.json(session)
    } catch (error: any) {
        console.log(error)

        throw new HTTPException(500, { message: error?.message })
    }
});

app.get('/success', (c) => {
    return c.text('Pago exitoso')
})

app.get('/cancel', (c) => {
    return c.text('Pago cancelado')
})

app.get('/', (c) => {
    const html = `
    <!DOCTYPE html>
    <html>
        <head>
            <title>Checkout</title>
            <script src="https://js.stripe.com/v3/"></script>
        </head>
        <body>
            <h1>Comprar</h1>
            <button id="checkoutButton">Comprar</button>

            <script>
                const checkoutButton = document.getElementById('checkoutButton')
                checkoutButton.addEventListener('click', async () => {
                    const response = await fetch('/checkout', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                    })
                    const { id } = await response.json()
                    const stripe = Stripe('${process.env.STRIPE_PUBLISHABLE_KEY}')
                    await stripe.redirectToCheckout({ sessionId: id })
                })
            </script>
        </body>
    </html>
    `

    return c.html(html)
})

app.post('/webhook', async (c) => {
    const raw = await c.req.text()
    const signature = c.req.header('stripe-signature')

    let event;
    try {
        event = stripe.webhooks.constructEvent(raw, signature!, process.env.STRIPE_WEBHOOK_SECRET!)
    } catch (error: any) {
        console.error(`Hubo un fallo al verificar la firma del Webhook: ${error.message}`)
        throw new HTTPException(400)
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object
        console.log(session)
    }

    return c.text('success')
})

const port = 3000
console.log(`El servidor se ejecuta en el puerto ${port}`)

serve({
  fetch: app.fetch,
  port
})
