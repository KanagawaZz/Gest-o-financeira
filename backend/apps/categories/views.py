from rest_framework import status
from rest_framework.response import Response

from common.mixins import OwnedModelViewSet

from .models import Category
from .serializers import CategorySerializer


class CategoryViewSet(OwnedModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    search_fields = ["name"]
    ordering_fields = ["name", "kind"]

    def get_queryset(self):
        qs = super().get_queryset()
        kind = self.request.query_params.get("kind")
        archived = self.request.query_params.get("is_archived")
        if kind:
            qs = qs.filter(kind=kind)
        if archived is not None:
            qs = qs.filter(is_archived=archived.lower() == "true")
        return qs

    def destroy(self, request, *args, **kwargs):
        # Categorias nunca são excluídas definitivamente: são arquivadas (plano §4.6).
        category = self.get_object()
        category.is_archived = True
        category.save(update_fields=["is_archived"])
        return Response(status=status.HTTP_204_NO_CONTENT)
