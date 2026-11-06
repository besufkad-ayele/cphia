import type { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function AdminStatus({
  code,
  title,
  description,
  children,
  note,
}: {
  code: string;
  title: string;
  description: string;
  children?: ReactNode;
  note?: string;
}) {
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <p className="text-xs font-semibold tracking-[0.16em] text-primary">{code}</p>
          <CardTitle className="text-2xl">{title}</CardTitle>
          <CardDescription className="text-sm leading-6">{description}</CardDescription>
        </CardHeader>
        {children || note ? (
          <CardContent className="grid gap-4">
            {children ? <div className="flex flex-wrap gap-2">{children}</div> : null}
            {note ? <p className="font-mono text-xs text-muted-foreground">{note}</p> : null}
          </CardContent>
        ) : null}
      </Card>
    </div>
  );
}
