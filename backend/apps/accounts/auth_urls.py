from django.urls import path

from .auth_views import CsrfView, ExportView, LoginView, LogoutView, MeView, PasswordView

urlpatterns = [
    path("csrf/", CsrfView.as_view(), name="auth-csrf"),
    path("login/", LoginView.as_view(), name="auth-login"),
    path("logout/", LogoutView.as_view(), name="auth-logout"),
    path("me/", MeView.as_view(), name="auth-me"),
    path("password/", PasswordView.as_view(), name="auth-password"),
    path("export/", ExportView.as_view(), name="auth-export"),
]
