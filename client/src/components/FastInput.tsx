import { useState, useEffect, useRef, startTransition, useCallback, forwardRef } from "react";

interface FastInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string;
  onValueChange: (value: string) => void;
  onChange?: never;
}

export const FastInput = forwardRef<HTMLInputElement, FastInputProps>(
  ({ value, onValueChange, ...props }, ref) => {
    const [localValue, setLocalValue] = useState(value);
    const isUserTyping = useRef(false);

    useEffect(() => {
      if (!isUserTyping.current) {
        setLocalValue(value);
      }
    }, [value]);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      const newVal = e.target.value;
      isUserTyping.current = true;
      setLocalValue(newVal);
      startTransition(() => {
        onValueChange(newVal);
        isUserTyping.current = false;
      });
    }, [onValueChange]);

    return (
      <input
        {...props}
        ref={ref}
        value={localValue}
        onChange={handleChange}
      />
    );
  }
);
FastInput.displayName = "FastInput";

interface FastTextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
  value: string;
  onValueChange: (value: string) => void;
  onChange?: never;
}

export const FastTextarea = forwardRef<HTMLTextAreaElement, FastTextareaProps>(
  ({ value, onValueChange, ...props }, ref) => {
    const [localValue, setLocalValue] = useState(value);
    const isUserTyping = useRef(false);

    useEffect(() => {
      if (!isUserTyping.current) {
        setLocalValue(value);
      }
    }, [value]);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newVal = e.target.value;
      isUserTyping.current = true;
      setLocalValue(newVal);
      startTransition(() => {
        onValueChange(newVal);
        isUserTyping.current = false;
      });
    }, [onValueChange]);

    return (
      <textarea
        {...props}
        ref={ref}
        value={localValue}
        onChange={handleChange}
      />
    );
  }
);
FastTextarea.displayName = "FastTextarea";
