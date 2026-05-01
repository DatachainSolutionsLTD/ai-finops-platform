{{- define "agent-chart.labels" -}}
app.kubernetes.io/name: finops-{{ .Values.agent.name }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Values.agent.version | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: finops
finops.io/agent-type: {{ .Values.agent.type }}
finops.io/stage: {{ .Values.global.stage }}
{{- end }}

{{- define "agent-chart.serviceAccountName" -}}
{{- if .Values.serviceAccount.name }}
{{- .Values.serviceAccount.name }}
{{- else }}
agent-{{ lower .Values.agent.type }}-sa
{{- end }}
{{- end }}
