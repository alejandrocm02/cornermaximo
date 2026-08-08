export const PASSWORD_MIN_LENGTH = 10;

export type PasswordRequirement = {
  key: 'length' | 'lowercase' | 'uppercase' | 'number' | 'symbol';
  label: string;
  valid: boolean;
};

export function getPasswordRequirements(password: string): PasswordRequirement[] {
  return [
    {
      key: 'length',
      label: `${PASSWORD_MIN_LENGTH} caracteres como mínimo`,
      valid: password.length >= PASSWORD_MIN_LENGTH,
    },
    {
      key: 'lowercase',
      label: 'Una letra minúscula',
      valid: /[a-z]/.test(password),
    },
    {
      key: 'uppercase',
      label: 'Una letra mayúscula',
      valid: /[A-Z]/.test(password),
    },
    {
      key: 'number',
      label: 'Un número',
      valid: /[0-9]/.test(password),
    },
    {
      key: 'symbol',
      label: 'Un símbolo (por ejemplo: !, @, #, %, &)',
      valid: /[^A-Za-z0-9\s]/.test(password),
    },
  ];
}

export function isPasswordValid(password: string): boolean {
  return getPasswordRequirements(password).every((requirement) => requirement.valid);
}

export function getPasswordValidationError(password: string): string | null {
  const missing = getPasswordRequirements(password).filter((requirement) => !requirement.valid);

  if (missing.length === 0) return null;

  return `La contraseña no cumple todos los requisitos: ${missing.map((requirement) => requirement.label.toLowerCase()).join(', ')}.`;
}
