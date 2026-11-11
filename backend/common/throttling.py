"""Limites gerais de requisições guardados na memória de cada processo do Gunicorn.

O limite geral (1000/min por usuário, 120/min por IP anônimo) é só uma rede de segurança contra
abuso: contá-lo no cache em banco custava ~6 comandos SQL em TODA requisição. Na memória local ele
vale por processo (2 workers = até 2x o limite), o que não importa para uma rede de segurança.

Os limites que precisam ser exatos entre processos (login, cadastro, troca e redefinição de senha)
usam ScopedRateThrottle com o cache "default" (banco em produção) e não passam por aqui.
"""
from django.core.cache import caches
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle

LOCAL_CACHE = "throttle_local"


class LocalAnonRateThrottle(AnonRateThrottle):
    cache = caches[LOCAL_CACHE]


class LocalUserRateThrottle(UserRateThrottle):
    cache = caches[LOCAL_CACHE]
