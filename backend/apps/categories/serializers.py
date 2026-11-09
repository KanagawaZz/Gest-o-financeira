import re

from rest_framework import serializers

from .models import Category

HEX = re.compile(r"^#[0-9A-Fa-f]{6}$")


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "name", "kind", "color", "icon", "is_archived", "created_at"]
        read_only_fields = ["id", "created_at"]

    def validate_color(self, value):
        if not HEX.match(value):
            raise serializers.ValidationError("Use uma cor no formato #RRGGBB.")
        return value

    def validate(self, attrs):
        owner = self.context["request"].user
        name = attrs.get("name", getattr(self.instance, "name", None))
        kind = attrs.get("kind", getattr(self.instance, "kind", None))
        qs = Category.objects.filter(owner=owner, kind=kind, name__iexact=name)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError({"name": "Já existe uma categoria com esse nome."})
        return attrs
