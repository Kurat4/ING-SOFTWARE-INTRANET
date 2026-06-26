import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface CoursePerformance {
  courseName: string;
  attendanceRate: number;
  averageScore: number;
  studentCount: number;
}

interface CoursePerformanceTableProps {
  courses: CoursePerformance[];
}

export function CoursePerformanceTable({ courses }: CoursePerformanceTableProps) {
  const sortedByAttendance = [...courses].sort((a, b) => b.attendanceRate - a.attendanceRate);
  const top3Attendance = sortedByAttendance.slice(0, 3);
  const bottom3Attendance = sortedByAttendance.slice(-3).reverse();

  const sortedByGrade = [...courses].sort((a, b) => b.averageScore - a.averageScore);
  const top3Grade = sortedByGrade.slice(0, 3);
  const bottom3Grade = sortedByGrade.slice(-3).reverse();

  const getAttendanceBadgeVariant = (rate: number) => {
    if (rate >= 90) return 'default';
    if (rate >= 75) return 'secondary';
    return 'destructive';
  };

  const getGradeBadgeVariant = (score: number) => {
    if (score >= 14) return 'default';
    if (score >= 11) return 'secondary';
    return 'destructive';
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-500" />
            Mejores Cursos - Asistencia
          </CardTitle>
          <CardDescription>Top 3 con mayor porcentaje de asistencia</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Curso</TableHead>
                <TableHead>Asistencia</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {top3Attendance.map((course, idx) => (
                <TableRow key={`top-att-${idx}`}>
                  <TableCell className="font-medium">{course.courseName}</TableCell>
                  <TableCell>
                    <Badge variant={getAttendanceBadgeVariant(course.attendanceRate)}>
                      {course.attendanceRate.toFixed(1)}%
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-red-500" />
            Cursos con Menor Asistencia
          </CardTitle>
          <CardDescription>Requieren atención en asistencia</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Curso</TableHead>
                <TableHead>Asistencia</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bottom3Attendance.map((course, idx) => (
                <TableRow key={`bottom-att-${idx}`}>
                  <TableCell className="font-medium">{course.courseName}</TableCell>
                  <TableCell>
                    <Badge variant={getAttendanceBadgeVariant(course.attendanceRate)}>
                      {course.attendanceRate.toFixed(1)}%
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-500" />
            Mejores Cursos - Calificaciones
          </CardTitle>
          <CardDescription>Top 3 con mejor promedio</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Curso</TableHead>
                <TableHead>Promedio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {top3Grade.map((course, idx) => (
                <TableRow key={`top-grade-${idx}`}>
                  <TableCell className="font-medium">{course.courseName}</TableCell>
                  <TableCell>
                    <Badge variant={getGradeBadgeVariant(course.averageScore)}>
                      {course.averageScore.toFixed(1)}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-red-500" />
            Cursos con Menores Calificaciones
          </CardTitle>
          <CardDescription>Requieren refuerzo académico</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Curso</TableHead>
                <TableHead>Promedio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bottom3Grade.map((course, idx) => (
                <TableRow key={`bottom-grade-${idx}`}>
                  <TableCell className="font-medium">{course.courseName}</TableCell>
                  <TableCell>
                    <Badge variant={getGradeBadgeVariant(course.averageScore)}>
                      {course.averageScore.toFixed(1)}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
