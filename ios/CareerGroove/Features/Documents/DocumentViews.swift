import Observation
import QuickLook
import SwiftUI

@MainActor
@Observable
final class DocumentsViewModel {
    var documents: [Document] = []
    var jobs: [DocumentJob] = []
    var isLoading = false
    var errorMessage: String?

    func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            async let documentsRequest = APIDocuments().list()
            async let jobsRequest = APIDocuments().jobs()
            (documents, jobs) = try await (documentsRequest, jobsRequest)
            errorMessage = nil
        } catch { errorMessage = error.localizedDescription }
    }
}

struct DocumentListView: View {
    @State private var model = DocumentsViewModel()
    @State private var showsStudio = false

    var body: some View {
        Group {
            if model.isLoading && model.documents.isEmpty && model.jobs.isEmpty { LoadingState() }
            else if let error = model.errorMessage, model.documents.isEmpty {
                ErrorState(message: error) { Task { await model.load() } }
            } else {
                List {
                    if !model.jobs.filter({ $0.status != "completed" }).isEmpty {
                        Section("In Progress") {
                            ForEach(model.jobs.filter { $0.status != "completed" }) { job in
                                HStack {
                                    ProgressView()
                                    VStack(alignment: .leading) {
                                        Text(job.kind.replacingOccurrences(of: "_", with: " ").capitalized)
                                        Text(job.status.capitalized).font(.caption).foregroundStyle(Color.plum)
                                    }
                                }
                            }
                        }
                    }
                    Section("Documents") {
                        if model.documents.isEmpty {
                            Text("Generated resumes and cover letters will appear here.").foregroundStyle(Color.plum)
                        }
                        ForEach(model.documents) { document in
                            NavigationLink { DocumentViewer(document: document) } label: {
                                Label {
                                    VStack(alignment: .leading) {
                                        Text(document.title).font(.headline)
                                        Text(document.kind.replacingOccurrences(of: "_", with: " ").capitalized)
                                            .font(.caption).foregroundStyle(Color.plum)
                                    }
                                } icon: { Image(systemName: "doc.text.fill").foregroundStyle(Color.coral) }
                            }
                        }
                    }
                }
                .listStyle(.insetGrouped).scrollContentBackground(.hidden)
            }
        }
        .background(Color.cream)
        .navigationTitle("Documents")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button { showsStudio = true } label: { Image(systemName: "wand.and.stars") }
                    .accessibilityLabel("Open AI Studio")
            }
        }
        .sheet(isPresented: $showsStudio) { NavigationStack { AIStudioView() } }
        .refreshable { await model.load() }
        .task { if model.documents.isEmpty { await model.load() } }
    }
}

struct DocumentViewer: View {
    let document: Document
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                PageHeadingView(document.title, subtitle: document.kind.replacingOccurrences(of: "_", with: " ").capitalized)
                Text(document.text.isEmpty ? "This document has no plain-text preview." : document.text)
                    .font(.body).textSelection(.enabled).foregroundStyle(Color.ink)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }.padding()
        }
        .background(Color.cream)
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct AIStudioView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var kind = "resume"
    @State private var title = ""
    @State private var company = ""
    @State private var description = ""
    @State private var isWorking = false
    @State private var resultMessage: String?

    var body: some View {
        Form {
            Section("Document") {
                Picker("Type", selection: $kind) {
                    Text("Resume").tag("resume")
                    Text("Cover Letter").tag("cover_letter")
                    Text("Both").tag("both")
                }
                .pickerStyle(.segmented)
            }
            Section("Target role") {
                TextField("Role title", text: $title)
                TextField("Company", text: $company)
                TextEditor(text: $description).frame(minHeight: 180)
            }
            Section {
                Button {
                    isWorking = true
                    Task {
                        defer { isWorking = false }
                        do {
                            _ = try await APIDocuments().generate(.init(
                                kind: kind, applicationId: nil,
                                target: .init(title: title, company: company, description: description)
                            ))
                            resultMessage = "Your document is queued."
                        } catch { resultMessage = error.localizedDescription }
                    }
                } label: {
                    HStack { Text("Generate"); Spacer(); if isWorking { ProgressView() } }
                }
                .disabled(title.isEmpty || company.isEmpty || description.isEmpty || isWorking)
            }
        }
        .scrollContentBackground(.hidden).background(Color.cream)
        .navigationTitle("AI Studio").navigationBarTitleDisplayMode(.inline)
        .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Done") { dismiss() } } }
        .alert("AI Studio", isPresented: Binding(
            get: { resultMessage != nil }, set: { if !$0 { resultMessage = nil } }
        )) { Button("OK") { if resultMessage == "Your document is queued." { dismiss() } } }
        message: { Text(resultMessage ?? "") }
    }
}
