import { getPasswordRequirements } from '@/lib/auth/passwordPolicy';

type PasswordRequirementsProps = {
  password: string;
};

export function PasswordRequirements({ password }: PasswordRequirementsProps) {
  const requirements = getPasswordRequirements(password);

  return (
    <div className="rounded-xl border border-pitch-border bg-pitch-bg/50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-pitch-muted">La contraseña debe incluir</p>
      <ul className="mt-2 grid gap-1.5 text-sm" aria-label="Requisitos de contraseña">
        {requirements.map((requirement) => (
          <li
            key={requirement.key}
            aria-label={`${requirement.label}: ${requirement.valid ? 'cumplido' : 'pendiente'}`}
            className={`flex items-start gap-2 ${requirement.valid ? 'text-pitch-accent' : 'text-pitch-muted'}`}
          >
            <span
              aria-hidden="true"
              className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border text-[10px] font-bold ${
                requirement.valid ? 'border-pitch-accent/60 bg-pitch-accent/10' : 'border-pitch-border'
              }`}
            >
              {requirement.valid ? '✓' : '·'}
            </span>
            <span>{requirement.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
