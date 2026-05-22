import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

class EmailService {
  private transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }

  /**
   * Enviar email de verificación
   */
  async sendVerificationEmail(email: string, token: string) {
    const urlVerificacion = `${process.env.CLIENT_URL}/auth/verificar/${token}`;

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: email,
      subject: 'Verifica tu cuenta - Ministerio Laico',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>¡Bienvenido/a!</h2>
          <p>Gracias por registrarte en Ministerio Laico.</p>
          <p>Para completar tu registro, por favor verifica tu email haciendo clic en el siguiente botón:</p>
          <a href="${urlVerificacion}" 
             style="display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 8px; margin: 20px 0;">
            Verificar Email
          </a>
          <p>O copia y pega este enlace en tu navegador:</p>
          <p style="color: #666; font-size: 14px;">${urlVerificacion}</p>
          <p style="color: #999; font-size: 12px; margin-top: 30px;">
            Este enlace expirará en 24 horas.
          </p>
        </div>
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log('Email de verificación enviado a:', email);
    } catch (error) {
      console.error('Error al enviar email de verificación:', error);
      throw error;
    }
  }

  /**
   * Enviar email de bienvenida
   */
  async sendWelcomeEmail(email: string, nombre: string) {
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: email,
      subject: '¡Bienvenido a Ministerio Laico!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>¡Hola ${nombre}!</h2>
          <p>Tu cuenta ha sido verificada exitosamente.</p>
          <p>Ya puedes acceder a la plataforma y comenzar tu formación.</p>
          <a href="${process.env.CLIENT_URL}/login" 
             style="display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 8px; margin: 20px 0;">
            Iniciar Sesión
          </a>
        </div>
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Error al enviar email de bienvenida:', error);
    }
  }

  /**
   * Enviar email de recuperación de contraseña
   */
  async sendPasswordResetEmail(email: string, token: string) {
    const urlReset = `${process.env.CLIENT_URL}/auth/reset-password/${token}`;

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: email,
      subject: 'Recuperación de Contraseña - Ministerio Laico',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Recuperación de Contraseña</h2>
          <p>Recibimos una solicitud para restablecer tu contraseña.</p>
          <p>Haz clic en el siguiente botón para crear una nueva contraseña:</p>
          <a href="${urlReset}" 
             style="display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 8px; margin: 20px 0;">
            Restablecer Contraseña
          </a>
          <p>O copia y pega este enlace en tu navegador:</p>
          <p style="color: #666; font-size: 14px;">${urlReset}</p>
          <p style="color: #999; font-size: 12px; margin-top: 30px;">
            Este enlace expirará en 1 hora. Si no solicitaste este cambio, ignora este email.
          </p>
        </div>
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Error al enviar email de recuperación:', error);
      throw error;
    }
  }

  /**
   * MÉTODO ANTIGUO (mantener compatibilidad)
   */
  async enviarEmailVerificacion(email: string, nombre: string, token: string) {
    const urlVerificacion = `${process.env.CLIENT_URL}/verificar-email/${token}`;

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: email,
      subject: 'Verifica tu cuenta - Ministerio Laico',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>¡Bienvenido/a ${nombre}!</h2>
          <p>Gracias por registrarte en Ministerio Laico.</p>
          <p>Para completar tu registro, por favor verifica tu email haciendo clic en el siguiente botón:</p>
          <a href="${urlVerificacion}" 
             style="display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 8px; margin: 20px 0;">
            Verificar Email
          </a>
          <p>O copia y pega este enlace en tu navegador:</p>
          <p style="color: #666; font-size: 14px;">${urlVerificacion}</p>
          <p style="color: #999; font-size: 12px; margin-top: 30px;">
            Este enlace expirará en 24 horas.
          </p>
        </div>
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log('Email de verificación enviado a:', email);
    } catch (error) {
      console.error('Error al enviar email de verificación:', error);
      throw error;
    }
  }

  /**
   * Enviar confirmación de matrícula
   */
  async enviarConfirmacionMatricula(email: string, nombre: string, codigoMatricula: string) {
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: email,
      subject: 'Confirmación de Matrícula - Ministerio Laico',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>¡Matrícula Confirmada!</h2>
          <p>Hola ${nombre},</p>
          <p>Tu matrícula ha sido confirmada exitosamente.</p>
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Código de Matrícula:</strong> ${codigoMatricula}</p>
            <p style="margin: 10px 0;"><strong>Monto:</strong> S/ 50.00</p>
          </div>
          <p>Ya puedes inscribirte en los cursos disponibles.</p>
          <a href="${process.env.CLIENT_URL}/cursos" 
             style="display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 8px; margin: 20px 0;">
            Ver Cursos Disponibles
          </a>
        </div>
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Error al enviar confirmación de matrícula:', error);
    }
  }

  /**
   * Enviar confirmación de inscripción a curso
   */
  async enviarConfirmacionInscripcion(
    email: string,
    nombre: string,
    nombreCurso: string,
    fechaInicio: Date
  ) {
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: email,
      subject: `Inscripción Confirmada - ${nombreCurso}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>¡Inscripción Confirmada!</h2>
          <p>Hola ${nombre},</p>
          <p>Tu inscripción al curso <strong>${nombreCurso}</strong> ha sido confirmada.</p>
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Curso:</strong> ${nombreCurso}</p>
            <p style="margin: 10px 0;"><strong>Fecha de Inicio:</strong> ${fechaInicio.toLocaleDateString()}</p>
          </div>
          <p>Ya puedes acceder al contenido del curso.</p>
          <a href="${process.env.CLIENT_URL}/mis-cursos" 
             style="display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 8px; margin: 20px 0;">
            Ir a Mis Cursos
          </a>
        </div>
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Error al enviar confirmación de inscripción:', error);
    }
  }

  /**
   * Enviar recordatorio de clase Zoom
   */
  async enviarRecordatorioClaseZoom(
    email: string,
    nombre: string,
    tituloClase: string,
    fechaHora: Date,
    urlZoom: string
  ) {
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: email,
      subject: `Recordatorio: ${tituloClase}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Recordatorio de Clase</h2>
          <p>Hola ${nombre},</p>
          <p>Te recordamos que tienes una clase programada:</p>
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Clase:</strong> ${tituloClase}</p>
            <p style="margin: 10px 0;"><strong>Fecha y Hora:</strong> ${fechaHora.toLocaleString()}</p>
          </div>
          <a href="${urlZoom}" 
             style="display: inline-block; padding: 12px 24px; background: #2D8CFF; color: white; text-decoration: none; border-radius: 8px; margin: 20px 0;">
            Unirse a la Clase
          </a>
          <p style="color: #666; font-size: 14px;">
            Enlace Zoom: ${urlZoom}
          </p>
        </div>
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Error al enviar recordatorio de clase:', error);
    }
  }

  /**
   * Enviar notificación de evaluación calificada
   */
  async enviarNotificacionEvaluacionCalificada(
    email: string,
    nombre: string,
    tituloEvaluacion: string,
    calificacion: number,
    puntuacionMaxima: number,
    aprobado: boolean
  ) {
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: email,
      subject: `Evaluación Calificada - ${tituloEvaluacion}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Evaluación Calificada</h2>
          <p>Hola ${nombre},</p>
          <p>Tu evaluación <strong>${tituloEvaluacion}</strong> ha sido calificada.</p>
          <div style="background: ${aprobado ? '#e8f5e9' : '#ffebee'}; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Calificación:</strong> ${calificacion} / ${puntuacionMaxima}</p>
            <p style="margin: 10px 0;"><strong>Estado:</strong> ${aprobado ? '✅ Aprobado' : '❌ Reprobado'}</p>
          </div>
          <a href="${process.env.CLIENT_URL}/mis-evaluaciones" 
             style="display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 8px; margin: 20px 0;">
            Ver Detalles
          </a>
        </div>
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Error al enviar notificación de evaluación:', error);
    }
  }

  /**
   * Enviar certificado
   */
  async enviarCertificado(
    email: string,
    nombre: string,
    codigoCertificado: string,
    urlCertificado: string
  ) {
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: email,
      subject: '¡Felicidades! Tu Certificado está Listo',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>🎓 ¡Felicidades ${nombre}!</h2>
          <p>Has completado exitosamente el programa de formación del Ministerio Laico.</p>
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 8px; margin: 20px 0; color: white; text-align: center;">
            <h3 style="margin: 0 0 10px 0;">Certificado Emitido</h3>
            <p style="margin: 0; font-size: 24px; font-weight: bold;">${codigoCertificado}</p>
          </div>
          <p>Puedes descargar tu certificado desde el siguiente enlace:</p>
          <a href="${urlCertificado}" 
             style="display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 8px; margin: 20px 0;">
            Descargar Certificado
          </a>
          <p style="color: #666; font-size: 14px; margin-top: 30px;">
            ¡Gracias por ser parte de nuestra comunidad de formación!
          </p>
        </div>
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Error al enviar certificado:', error);
    }
  }

  /**
   * Enviar recuperación de contraseña
   */
  async enviarRecuperacionPassword(email: string, nombre: string, token: string) {
    const urlReset = `${process.env.CLIENT_URL}/reset-password/${token}`;

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: email,
      subject: 'Recuperación de Contraseña - Ministerio Laico',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Recuperación de Contraseña</h2>
          <p>Hola ${nombre},</p>
          <p>Recibimos una solicitud para restablecer tu contraseña.</p>
          <p>Haz clic en el siguiente botón para crear una nueva contraseña:</p>
          <a href="${urlReset}" 
             style="display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 8px; margin: 20px 0;">
            Restablecer Contraseña
          </a>
          <p>O copia y pega este enlace en tu navegador:</p>
          <p style="color: #666; font-size: 14px;">${urlReset}</p>
          <p style="color: #999; font-size: 12px; margin-top: 30px;">
            Este enlace expirará en 1 hora. Si no solicitaste este cambio, ignora este email.
          </p>
        </div>
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Error al enviar recuperación de contraseña:', error);
      throw error;
    }
  }

  /**
   * Verificar configuración del servicio
   */
  async verificarConexion() {
    try {
      await this.transporter.verify();
      console.log('✅ Servicio de email configurado correctamente');
      return true;
    } catch (error) {
      console.error('❌ Error en configuración de email:', error);
      return false;
    }
  }
}

export default new EmailService();