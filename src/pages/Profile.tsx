import { useState, useEffect } from "react";
import { useLocation, useNavigate } from 'react-router-dom';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { formatDateInUserTimezone } from '@/lib/timezoneUtils';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { User, Camera, Mail, Phone, Calendar, Shield, ClipboardCheck, FileText, MapPin, GraduationCap, Users } from "lucide-react";
import { StudentAttendance } from "@/components/profile/StudentAttendance";
import { Notifications } from "@/components/Notifications";
import { UserRolesManager } from "@/components/profile/UserRolesManager";

// Schema para campos editables del perfil
const profileFormSchema = z.object({
  first_name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  last_name: z.string().min(2, "El apellido debe tener al menos 2 caracteres"),
  paternal_surname: z.string().optional(),
  maternal_surname: z.string().optional(),
  phone: z.string().optional(),
  avatar_url: z.string().optional(),
  gender: z.string().optional(),
  birth_date: z.string().optional(),
  country: z.string().optional(),
  education_level: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

export default function Profile() {
  const { profile, user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      first_name: profile?.first_name || "",
      last_name: profile?.last_name || "",
      paternal_surname: profile?.paternal_surname || "",
      maternal_surname: profile?.maternal_surname || "",
      phone: profile?.phone || "",
      avatar_url: profile?.avatar_url || "",
      gender: profile?.gender || "",
      birth_date: profile?.birth_date || "",
      country: profile?.country || "Perú",
      education_level: profile?.education_level || "",
    },
  });

  const onSubmit = async (data: ProfileFormValues) => {
    if (!profile) return;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          first_name: data.first_name,
          last_name: data.last_name,
          paternal_surname: data.paternal_surname || null,
          maternal_surname: data.maternal_surname || null,
          phone: data.phone || null,
          avatar_url: data.avatar_url || null,
          gender: data.gender || null,
          birth_date: data.birth_date || null,
          country: data.country || null,
          education_level: data.education_level || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", profile.id);

      if (error) throw error;

      toast({
        title: "Perfil actualizado",
        description: "Tu información ha sido actualizada correctamente.",
      });

      // Recargar la página para refrescar los datos
      window.location.reload();
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo actualizar el perfil.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'Administrador';
      case 'teacher': return 'Docente';
      case 'student': return 'Estudiante';
      case 'parent': return 'Padre de Familia';
      case 'tutor': return 'Tutor';
      default: return 'Usuario';
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-destructive text-destructive-foreground';
      case 'teacher': return 'bg-primary text-primary-foreground';
      case 'student': return 'bg-secondary text-secondary-foreground';
      case 'parent': return 'bg-accent text-accent-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  if (!profile) {
    return (
      <DashboardLayout>
        <div className="text-center">Cargando perfil...</div>
      </DashboardLayout>
    );
  }

  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const initialTab = params.get('tab') || 'info';
  const [activeTab, setActiveTab] = useState<string>(initialTab);

  useEffect(() => {
    // Keep url in sync when tab changes
    const p = new URLSearchParams(location.search);
    p.set('tab', activeTab);
    navigate({ pathname: location.pathname, search: p.toString() }, { replace: true });
  }, [activeTab]);

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6 p-6 bg-gradient-to-br from-background to-muted/30 min-h-screen">
            {/* Header del Perfil */}
            <div className="flex items-center gap-4 mb-8">
              <Avatar className="h-20 w-20 border-4 border-primary/20">
                <AvatarImage src={profile.avatar_url} alt="Avatar" />
                <AvatarFallback className="bg-gradient-primary text-primary-foreground text-2xl font-semibold">
                  {getInitials(profile.first_name, profile.last_name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-foreground">
                  {profile.first_name} {profile.last_name}
                </h1>
                <p className="text-muted-foreground text-lg">{profile.email}</p>
                <div className="flex gap-2 mt-2 flex-wrap">
                  {profile.roles && profile.roles.length > 0 ? (
                    profile.roles.map(role => (
                      <Badge key={role} className={getRoleColor(role)}>
                        <Shield className="w-4 h-4 mr-1" />
                        {getRoleLabel(role)}
                      </Badge>
                    ))
                  ) : (
                    <Badge className={getRoleColor(profile.role)}>
                      <Shield className="w-4 h-4 mr-1" />
                      {getRoleLabel(profile.role)}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v)} className="space-y-6">
              <TabsList className={`grid w-full ${profile.role === 'student' ? 'grid-cols-3' : 'grid-cols-2'}`}>
                <TabsTrigger value="info">Información Personal</TabsTrigger>
                {profile.role === 'student' && (
                  <TabsTrigger value="attendance" className="flex items-center gap-2">
                    <ClipboardCheck className="h-4 w-4" />
                    Mi Asistencia
                  </TabsTrigger>
                )}
                <TabsTrigger value="notifications">Notificaciones</TabsTrigger>
              </TabsList>

              <TabsContent value="info">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Información del Perfil */}
                  <div className="lg:col-span-1 space-y-4">
                <Card className="bg-gradient-card border-border/50 shadow-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="w-5 h-5 text-primary" />
                      Información Personal
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Email</p>
                        <p className="font-medium">{profile.email}</p>
                      </div>
                    </div>
                    
                    {profile.phone && (
                      <div className="flex items-center gap-3">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm text-muted-foreground">Teléfono</p>
                          <p className="font-medium">{profile.phone}</p>
                        </div>
                      </div>
                    )}

                    {profile.gender && (
                      <div className="flex items-center gap-3">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm text-muted-foreground">Género</p>
                          <p className="font-medium">{profile.gender}</p>
                        </div>
                      </div>
                    )}

                    {profile.birth_date && (
                      <div className="flex items-center gap-3">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm text-muted-foreground">Fecha de Nacimiento</p>
                          <p className="font-medium">
                            {formatDateInUserTimezone(profile.birth_date)}
                          </p>
                        </div>
                      </div>
                    )}

                    {profile.country && (
                      <div className="flex items-center gap-3">
                        <MapPin className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm text-muted-foreground">País</p>
                          <p className="font-medium">{profile.country}</p>
                        </div>
                      </div>
                    )}

                    <Separator />
                    
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">Estado de la cuenta</p>
                      <Badge variant={profile.is_active ? "default" : "destructive"}>
                        {profile.is_active ? "Activo" : "Inactivo"}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-3">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Miembro desde</p>
                        <p className="font-medium">
                          {user?.created_at ? formatDateInUserTimezone(user.created_at) : 'No disponible'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Información Académica/Documentación */}
                <Card className="bg-gradient-card border-border/50 shadow-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-primary" />
                      Información Adicional
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {profile.document_type && profile.document_number && (
                      <div className="flex items-center gap-3">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm text-muted-foreground">Documento de Identidad</p>
                          <p className="font-medium">{profile.document_type}: {profile.document_number}</p>
                        </div>
                      </div>
                    )}

                    {profile.student_code && (
                      <div className="flex items-center gap-3">
                        <GraduationCap className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm text-muted-foreground">Código de Estudiante</p>
                          <p className="font-medium">{profile.student_code}</p>
                        </div>
                      </div>
                    )}

                    {profile.education_level && (
                      <div className="flex items-center gap-3">
                        <GraduationCap className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm text-muted-foreground">Nivel Educativo</p>
                          <p className="font-medium">{profile.education_level}</p>
                        </div>
                      </div>
                    )}

                    {(profile.paternal_surname || profile.maternal_surname) && (
                      <>
                        <Separator />
                        <div className="space-y-2">
                          <p className="text-sm text-muted-foreground">Apellidos Completos</p>
                          {profile.paternal_surname && (
                            <p className="font-medium">Paterno: {profile.paternal_surname}</p>
                          )}
                          {profile.maternal_surname && (
                            <p className="font-medium">Materno: {profile.maternal_surname}</p>
                          )}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Formulario de Edición */}
              <div className="lg:col-span-2">
                <Card className="bg-gradient-card border-border/50 shadow-card">
                  <CardHeader>
                    <CardTitle>Editar Perfil</CardTitle>
                    <CardDescription>
                      Actualiza tu información personal. Los campos como email, código de estudiante y documento de identidad solo pueden ser modificados por un administrador.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        
                        {/* Información Básica */}
                        <div className="space-y-4">
                          <h3 className="text-lg font-semibold flex items-center gap-2">
                            <User className="w-5 h-5 text-primary" />
                            Información Básica
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="first_name"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Nombre *</FormLabel>
                                  <FormControl>
                                    <Input 
                                      placeholder="Tu nombre" 
                                      {...field}
                                      className="bg-background/60 border-border/50 focus:border-primary"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="last_name"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Apellido *</FormLabel>
                                  <FormControl>
                                    <Input 
                                      placeholder="Tu apellido" 
                                      {...field}
                                      className="bg-background/60 border-border/50 focus:border-primary"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="paternal_surname"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Apellido Paterno</FormLabel>
                                  <FormControl>
                                    <Input 
                                      placeholder="Apellido paterno" 
                                      {...field}
                                      className="bg-background/60 border-border/50 focus:border-primary"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="maternal_surname"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Apellido Materno</FormLabel>
                                  <FormControl>
                                    <Input 
                                      placeholder="Apellido materno" 
                                      {...field}
                                      className="bg-background/60 border-border/50 focus:border-primary"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>

                        <Separator />

                        {/* Información Personal */}
                        <div className="space-y-4">
                          <h3 className="text-lg font-semibold flex items-center gap-2">
                            <Users className="w-5 h-5 text-primary" />
                            Datos Personales
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="gender"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Género</FormLabel>
                                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                      <SelectTrigger className="bg-background/60 border-border/50 focus:border-primary">
                                        <SelectValue placeholder="Selecciona tu género" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="Masculino">Masculino</SelectItem>
                                      <SelectItem value="Femenino">Femenino</SelectItem>
                                      <SelectItem value="Otro">Otro</SelectItem>
                                      <SelectItem value="Prefiero no decir">Prefiero no decir</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="birth_date"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Fecha de Nacimiento</FormLabel>
                                  <FormControl>
                                    <Input 
                                      type="date"
                                      {...field}
                                      className="bg-background/60 border-border/50 focus:border-primary"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="country"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>País</FormLabel>
                                  <FormControl>
                                    <Input 
                                      placeholder="País de residencia" 
                                      {...field}
                                      className="bg-background/60 border-border/50 focus:border-primary"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="phone"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Teléfono</FormLabel>
                                  <FormControl>
                                    <Input 
                                      placeholder="Tu número de teléfono" 
                                      {...field}
                                      className="bg-background/60 border-border/50 focus:border-primary"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>

                        <Separator />

                        {/* Información Académica */}
                        <div className="space-y-4">
                          <h3 className="text-lg font-semibold flex items-center gap-2">
                            <GraduationCap className="w-5 h-5 text-primary" />
                            Información Académica
                          </h3>
                          <FormField
                            control={form.control}
                            name="education_level"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Nivel Educativo</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger className="bg-background/60 border-border/50 focus:border-primary">
                                      <SelectValue placeholder="Selecciona tu nivel educativo" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="Primaria">Primaria</SelectItem>
                                    <SelectItem value="Secundaria">Secundaria</SelectItem>
                                    <SelectItem value="Técnico">Técnico</SelectItem>
                                    <SelectItem value="Universitario">Universitario</SelectItem>
                                    <SelectItem value="Postgrado">Postgrado</SelectItem>
                                    <SelectItem value="Maestría">Maestría</SelectItem>
                                    <SelectItem value="Doctorado">Doctorado</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <Separator />

                        {/* Avatar */}
                        <div className="space-y-4">
                          <h3 className="text-lg font-semibold flex items-center gap-2">
                            <Camera className="w-5 h-5 text-primary" />
                            Imagen de Perfil
                          </h3>
                          <FormField
                            control={form.control}
                            name="avatar_url"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>URL del Avatar</FormLabel>
                                <FormControl>
                                  <Input 
                                    placeholder="https://ejemplo.com/mi-avatar.jpg" 
                                    {...field}
                                    className="bg-background/60 border-border/50 focus:border-primary"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        {/* Campos no editables - Solo información */}
                        <div className="bg-muted/30 p-4 rounded-lg border border-border/50">
                          <h4 className="text-sm font-semibold text-muted-foreground mb-2">
                            Campos no editables (solo administradores)
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                            <div>
                              <span className="text-muted-foreground">Email:</span>
                              <span className="ml-2 font-medium">{profile.email}</span>
                            </div>
                            {profile.document_type && profile.document_number && (
                              <div>
                                <span className="text-muted-foreground">Documento:</span>
                                <span className="ml-2 font-medium">{profile.document_type} {profile.document_number}</span>
                              </div>
                            )}
                            {profile.student_code && (
                              <div>
                                <span className="text-muted-foreground">Código:</span>
                                <span className="ml-2 font-medium">{profile.student_code}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <Button 
                          type="submit" 
                          disabled={isLoading}
                          className="w-full bg-gradient-primary hover:shadow-glow transition-all duration-300"
                        >
                          {isLoading ? "Guardando..." : "Guardar Cambios"}
                        </Button>
                      </form>
                    </Form>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

                {profile.role === 'student' && (
                  <TabsContent value="attendance">
                    <StudentAttendance />
                  </TabsContent>
                )}

                <TabsContent value="notifications">
                  <Notifications />
                </TabsContent>
              </Tabs>
      </div>
    </DashboardLayout>
  );
}