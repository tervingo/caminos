import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { type Login, loginSchema } from '@caminos/shared';
import { CONTENEDOR } from '../../components/ui';
import { Boton, Campo, INPUT, MensajeError } from '../../features/admin/ui';
import { useLogin, useSesion } from '../../lib/admin';

/** Solo se aceptan rutas internas del editor como destino tras entrar */
function destinoSeguro(valor: string | null) {
  return valor?.startsWith('/admin') ? valor : '/admin';
}

export function AdminLogin() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const sesion = useSesion();
  const login = useLogin();
  const destino = destinoSeguro(params.get('volver'));
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Login>({ resolver: zodResolver(loginSchema) });

  if (sesion.data) return <Navigate to={destino} replace />;

  return (
    <section className={`${CONTENEDOR} max-w-md! pt-16`}>
      <title>Acceso del autor · Nuestro Camino</title>
      <p className="text-[13px] font-semibold uppercase tracking-[.12em] text-bosque">Modo editor</p>
      <h1 className="mt-3 mb-8 font-serif text-[44px] leading-tight font-medium">Acceso del autor</h1>
      <form
        noValidate
        onSubmit={handleSubmit((datos) => login.mutate(datos, { onSuccess: () => navigate(destino, { replace: true }) }))}
        className="flex flex-col gap-4 rounded-2xl border border-linea bg-white p-6"
      >
        <Campo etiqueta="Email" error={errors.email && 'Escribe un email válido'}>
          {(p) => <input {...p} {...register('email')} type="email" autoComplete="username" className={INPUT} />}
        </Campo>
        <Campo etiqueta="Contraseña" error={errors.password && 'Escribe la contraseña'}>
          {(p) => <input {...p} {...register('password')} type="password" autoComplete="current-password" className={INPUT} />}
        </Campo>
        <MensajeError error={login.error} />
        <Boton type="submit" variante="primario" disabled={login.isPending}>
          {login.isPending ? 'Entrando…' : 'Entrar'}
        </Boton>
      </form>
    </section>
  );
}
