import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';
import axios from 'axios';

const prisma = new PrismaClient();

class PagosService {
  private stripe: Stripe | null = null;
  
  constructor() {
    this.initializeGateways();
  }

  private async initializeGateways() {
    try {
      // Inicializar Stripe
      const stripeConfig = await prisma.configuracionPago.findUnique({
        where: { metodoPago: 'stripe' }
      });
      
      if (stripeConfig?.secretKey) {
        this.stripe = new Stripe(stripeConfig.secretKey, {
          apiVersion: '2023-10-16'
        });
      }
    } catch (error) {
      console.error('Error inicializando gateways:', error);
    }
  }

  /**
   * STRIPE
   */
  async createStripePayment(
    amount: number,
    description: string,
    metadata: any
  ) {
    try {
      if (!this.stripe) {
        return { success: false, error: 'Stripe no está configurado' };
      }

      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'pen',
              product_data: {
                name: description,
              },
              unit_amount: Math.round(amount * 100), // Stripe usa centavos
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: metadata.returnUrl || `${process.env.FRONTEND_URL}/pagos/exitoso?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: metadata.cancelUrl || `${process.env.FRONTEND_URL}/pagos/cancelado`,
        metadata: {
          pagoId: metadata.pagoId,
          codigoTransaccion: metadata.codigoTransaccion,
        },
      });

      return {
        success: true,
        checkoutUrl: session.url,
        sessionId: session.id,
        paymentIntentId: session.payment_intent as string,
      };
    } catch (error: any) {
      console.error('Error en Stripe:', error);
      return { success: false, error: error.message };
    }
  }

  async verifyStripePayment(sessionId: string) {
    try {
      if (!this.stripe) {
        return { verified: false, error: 'Stripe no configurado' };
      }

      const session = await this.stripe.checkout.sessions.retrieve(sessionId);

      if (session.payment_status === 'paid') {
        return {
          verified: true,
          data: {
            transactionId: session.payment_intent,
            amount: session.amount_total! / 100,
            email: session.customer_details?.email,
          },
        };
      }

      return { verified: false, error: 'Pago no completado' };
    } catch (error: any) {
      console.error('Error verificando Stripe:', error);
      return { verified: false, error: error.message };
    }
  }

  /**
   * PAYPAL
   */
  async createPayPalPayment(
    amount: number,
    description: string,
    metadata: any
  ) {
    try {
      const config = await prisma.configuracionPago.findUnique({
        where: { metodoPago: 'paypal' }
      });

      if (!config?.secretKey || !config?.publicKey) {
        return { success: false, error: 'PayPal no está configurado' };
      }

      // Obtener token de acceso
      const auth = Buffer.from(`${config.publicKey}:${config.secretKey}`).toString('base64');
      
      const tokenResponse = await axios.post(
        `${process.env.PAYPAL_API_URL || 'https://api-m.sandbox.paypal.com'}/v1/oauth2/token`,
        'grant_type=client_credentials',
        {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      const accessToken = tokenResponse.data.access_token;

      // Crear orden de pago
      const orderResponse = await axios.post(
        `${process.env.PAYPAL_API_URL || 'https://api-m.sandbox.paypal.com'}/v2/checkout/orders`,
        {
          intent: 'CAPTURE',
          purchase_units: [
            {
              amount: {
                currency_code: 'USD',
                value: amount.toFixed(2)
              },
              description: description,
              custom_id: metadata.codigoTransaccion
            }
          ],
          application_context: {
            return_url: metadata.returnUrl || `${process.env.FRONTEND_URL}/pagos/exitoso`,
            cancel_url: metadata.cancelUrl || `${process.env.FRONTEND_URL}/pagos/cancelado`,
            brand_name: 'Instituto Bíblico',
            user_action: 'PAY_NOW'
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const approveLink = orderResponse.data.links.find((link: any) => link.rel === 'approve');

      return {
        success: true,
        checkoutUrl: approveLink.href,
        sessionId: orderResponse.data.id,
        paymentIntentId: orderResponse.data.id
      };
    } catch (error: any) {
      console.error('Error en PayPal:', error.response?.data || error);
      return { success: false, error: error.message };
    }
  }

  async verifyPayPalPayment(orderId: string) {
    try {
      const config = await prisma.configuracionPago.findUnique({
        where: { metodoPago: 'paypal' }
      });

      if (!config?.secretKey || !config?.publicKey) {
        return { verified: false, error: 'PayPal no configurado' };
      }

      const auth = Buffer.from(`${config.publicKey}:${config.secretKey}`).toString('base64');
      
      const tokenResponse = await axios.post(
        `${process.env.PAYPAL_API_URL || 'https://api-m.sandbox.paypal.com'}/v1/oauth2/token`,
        'grant_type=client_credentials',
        {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      const accessToken = tokenResponse.data.access_token;

      // Capturar el pago
      const captureResponse = await axios.post(
        `${process.env.PAYPAL_API_URL || 'https://api-m.sandbox.paypal.com'}/v2/checkout/orders/${orderId}/capture`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (captureResponse.data.status === 'COMPLETED') {
        const capture = captureResponse.data.purchase_units[0].payments.captures[0];
        
        return {
          verified: true,
          data: {
            transactionId: capture.id,
            amount: parseFloat(capture.amount.value),
            email: captureResponse.data.payer.email_address
          }
        };
      }

      return { verified: false, error: 'Pago no completado' };
    } catch (error: any) {
      console.error('Error verificando PayPal:', error.response?.data || error);
      return { verified: false, error: error.message };
    }
  }

  /**
   * MERCADO PAGO
   */
  async createMercadoPagoPayment(
    amount: number,
    description: string,
    metadata: any
  ) {
    try {
      const config = await prisma.configuracionPago.findUnique({
        where: { metodoPago: 'mercado_pago' }
      });

      if (!config?.secretKey) {
        return { success: false, error: 'Mercado Pago no está configurado' };
      }

      const preference = {
        items: [
          {
            title: description,
            quantity: 1,
            unit_price: Number(amount.toFixed(2)),
            currency_id: 'PEN'
          }
        ],
        back_urls: {
          success: metadata.returnUrl || `${process.env.FRONTEND_URL}/pagos/exitoso`,
          failure: metadata.cancelUrl || `${process.env.FRONTEND_URL}/pagos/fallido`,
          pending: `${process.env.FRONTEND_URL}/pagos/pendiente`
        },
        auto_return: 'approved',
        external_reference: metadata.codigoTransaccion,
        notification_url: `${process.env.API_URL}/webhooks/mercadopago`,
        statement_descriptor: 'Instituto Biblico'
      };

      const response = await axios.post(
        'https://api.mercadopago.com/checkout/preferences',
        preference,
        {
          headers: {
            'Authorization': `Bearer ${config.secretKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        checkoutUrl: response.data.init_point,
        sessionId: response.data.id,
        paymentIntentId: response.data.id
      };
    } catch (error: any) {
      console.error('Error en Mercado Pago:', error.response?.data || error);
      return { success: false, error: error.message };
    }
  }

  async verifyMercadoPagoPayment(preferenceId: string) {
    try {
      const config = await prisma.configuracionPago.findUnique({
        where: { metodoPago: 'mercado_pago' }
      });

      if (!config?.secretKey) {
        return { verified: false, error: 'Mercado Pago no configurado' };
      }

      // Buscar pagos asociados a esta preferencia
      const response = await axios.get(
        `https://api.mercadopago.com/v1/payments/search?external_reference=${preferenceId}`,
        {
          headers: {
            'Authorization': `Bearer ${config.secretKey}`
          }
        }
      );

      const payment = response.data.results.find((p: any) => p.status === 'approved');

      if (payment) {
        return {
          verified: true,
          data: {
            transactionId: payment.id,
            amount: payment.transaction_amount,
            email: payment.payer.email
          }
        };
      }

      return { verified: false, error: 'Pago no aprobado' };
    } catch (error: any) {
      console.error('Error verificando Mercado Pago:', error.response?.data || error);
      return { verified: false, error: error.message };
    }
  }

  /**
   * Procesar pago completado (aplicar cambios en matrícula o inscripciones)
   */
async procesarPagoCompletado(pagoId: number, gatewayData?: any) {
  try {
    const pago = await prisma.pago.findUnique({
      where: { id: pagoId }
    });

    if (!pago) {
      throw new Error('Pago no encontrado');
    }

    // Actualizar estado del pago
    const pagoActualizado = await prisma.pago.update({
      where: { id: pagoId },
      data: {
        estado: 'completado',
        referenciaExterna: gatewayData?.transactionId,
        webhookData: gatewayData
      }
    });

    // Verificar si es pago múltiple
    const detalles = pagoActualizado.detallesPago as any;
    const esPagoMultiple = detalles?.esPagoMultiple === true;
    const inscripcionesIds = detalles?.inscripcionesIds || [];

    // ⬇️ SOLO CAMBIAR EL ESTADO A 'pagado', los demás campos ya están guardados
    if (pago.tipoPago === 'matricula') {
      await prisma.matricula.update({
        where: { id: pago.idReferencia },
        data: {
          estadoPago: 'pagado' // ⬅️ SOLO cambiar el estado
          // metodoPago, referenciaPago, fechaPago ya están guardados
        }
      });
      console.log('✅ Matrícula aprobada - estado cambiado a pagado');
    } else if (pago.tipoPago === 'curso') {
      if (esPagoMultiple && Array.isArray(inscripcionesIds) && inscripcionesIds.length > 0) {
        // Pago múltiple: actualizar todas las inscripciones
        await prisma.inscripcionCurso.updateMany({
          where: {
            id: { in: inscripcionesIds },
            usuarioId: pago.usuarioId
          },
          data: {
            estadoPago: 'pagado',
            estadoCurso: 'en_progreso',
            fechaInicio: new Date()
          }
        });
        console.log(`✅ Pago múltiple aprobado: ${inscripcionesIds.length} cursos`);
      } else {
        // Pago individual
        await prisma.inscripcionCurso.update({
          where: { id: pago.idReferencia },
          data: {
            estadoPago: 'pagado',
            estadoCurso: 'en_progreso',
            fechaInicio: new Date()
          }
        });
        console.log('✅ Inscripción aprobada - estado cambiado a pagado');
      }
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error procesando pago:', error);
    return { success: false, error: error.message };
  }
}



}

export default new PagosService();