import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Eye } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  paternal_surname: string;
  maternal_surname: string;
  student_code: string;
  email: string;
  phone?: string;
  document_number?: string;
  birth_date?: string;
}

interface RiskStudent {
  student: Student;
  attendanceRate: number;
  averageScore: number;
  riskFactors: string[];
}

interface StudentsAtRiskTableProps {
  students: RiskStudent[];
  onViewDetails: (student: Student) => void;
}

export function StudentsAtRiskTable({ students, onViewDetails }: StudentsAtRiskTableProps) {
  if (students.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-green-500" />
            Estudiantes en Riesgo
          </CardTitle>
          <CardDescription>Estudiantes con asistencia menor a 75% o promedio menor a 11</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[200px]">
          <div className="text-center">
            <p className="text-lg font-semibold text-green-600">¡Excelente!</p>
            <p className="text-muted-foreground">No hay estudiantes en riesgo actualmente</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          Estudiantes en Riesgo ({students.length})
        </CardTitle>
        <CardDescription>Requieren atención prioritaria</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Estudiante</TableHead>
              <TableHead>Código</TableHead>
              <TableHead>Asistencia</TableHead>
              <TableHead>Promedio</TableHead>
              <TableHead>Factores de Riesgo</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.map(({ student, attendanceRate, averageScore, riskFactors }) => (
              <TableRow key={student.id} className="bg-destructive/5">
                <TableCell className="font-medium">
                  {student.paternal_surname} {student.maternal_surname}, {student.first_name}
                </TableCell>
                <TableCell>{student.student_code}</TableCell>
                <TableCell>
                  <Badge variant={attendanceRate < 60 ? 'destructive' : 'outline'}>
                    {attendanceRate.toFixed(1)}%
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={averageScore < 11 ? 'destructive' : 'outline'}>
                    {averageScore > 0 ? averageScore.toFixed(1) : 'N/A'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {riskFactors.map((factor, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {factor}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onViewDetails(student)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
