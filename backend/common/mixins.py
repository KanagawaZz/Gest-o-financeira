from rest_framework import viewsets


class OwnedModelViewSet(viewsets.ModelViewSet):
    """Isola dados por proprietário: lista só o que é do usuário e grava `owner` no servidor."""

    def get_queryset(self):
        return super().get_queryset().filter(owner=self.request.user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)
