import type { InputHTMLAttributes } from 'react';
import type { LucideIcon } from 'lucide-react';

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  /** Ícone do lucide-react exibido dentro do campo. */
  icon?: LucideIcon;
}

/**
 * Campo de formulário com rótulo e ícone — extraído das três telas do
 * LoginModal, onde o mesmo bloco estava duplicado seis vezes.
 */
export default function FormField({
  label,
  icon: Icon,
  className = '',
  ...props
}: FormFieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="relative">
        {Icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Icon className="h-5 w-5 text-gray-400" />
          </div>
        )}
        <input
          {...props}
          className={`block w-full ${Icon ? 'pl-10' : ''} px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500 ${className}`}
        />
      </div>
    </div>
  );
}
