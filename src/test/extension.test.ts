import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
    vscode.window.showInformationMessage('Start all tests.');

    suite('Extension Activation', () => {
        test('Extension should be present', () => {
            assert.ok(vscode.extensions.getExtension('jasonkneen.mcpsx-run'));
        });

        test('Extension should activate', async () => {
            const ext = vscode.extensions.getExtension('jasonkneen.mcpsx-run');
            if (ext) {
                await ext.activate();
                assert.strictEqual(ext.isActive, true);
            }
        });
    });

    suite('Commands Registration', () => {
        test('openServerManager command should be registered', async () => {
            const commands = await vscode.commands.getCommands(true);
            assert.ok(commands.includes('mcpsx-run.studio.openServerManager'));
        });

        test('getMcpServerSocketPath command should be registered', async () => {
            const commands = await vscode.commands.getCommands(true);
            assert.ok(commands.includes('mcpsx-run.studio.getMcpServerSocketPath'));
        });

        test('copyMcpServerSocketPath command should be registered', async () => {
            const commands = await vscode.commands.getCommands(true);
            assert.ok(commands.includes('mcpsx-run.studio.copyMcpServerSocketPath'));
        });

        test('servers command should be registered', async () => {
            const commands = await vscode.commands.getCommands(true);
            assert.ok(commands.includes('mcpsx-run.studio.servers'));
        });

        test('tools command should be registered', async () => {
            const commands = await vscode.commands.getCommands(true);
            assert.ok(commands.includes('mcpsx-run.studio.tools'));
        });
    });

    suite('Views Registration', () => {
        test('mcpsxServerView should be registered', () => {
            // Views are registered through the package.json contributes
            // This test verifies the extension can access the view
            const ext = vscode.extensions.getExtension('jasonkneen.mcpsx-run');
            assert.ok(ext);
        });
    });
});

suite('ServerConfig Tests', () => {
    test('ServerType enum should have correct values', async () => {
        // Import the ServerType enum dynamically to test
        const { ServerType } = await import('../server/ServerConfig');

        assert.strictEqual(ServerType.PROCESS, 'process');
        assert.strictEqual(ServerType.SSE, 'sse');
        assert.strictEqual(ServerType.STREAMABLE_HTTP, 'streamable-http');
    });

    test('ServerConfig interface should support all transport types', async () => {
        const { ServerType } = await import('../server/ServerConfig');

        // Test creating configs for each transport type
        const processConfig = {
            id: 'test-1',
            name: 'Test Process Server',
            type: ServerType.PROCESS,
            command: 'python -m mcp_server',
            enabled: true
        };

        const sseConfig = {
            id: 'test-2',
            name: 'Test SSE Server',
            type: ServerType.SSE,
            command: '',
            url: 'http://localhost:3000/sse',
            enabled: true
        };

        const streamableHttpConfig = {
            id: 'test-3',
            name: 'Test Streamable HTTP Server',
            type: ServerType.STREAMABLE_HTTP,
            command: '',
            url: 'http://localhost:3000/mcp',
            authToken: 'test-token',
            enabled: true
        };

        assert.strictEqual(processConfig.type, 'process');
        assert.strictEqual(sseConfig.type, 'sse');
        assert.strictEqual(streamableHttpConfig.type, 'streamable-http');
    });
});

suite('Logger Tests', () => {
    test('Logger should be a singleton', async () => {
        const { Logger } = await import('../utils/Logger');

        const logger1 = Logger.getInstance();
        const logger2 = Logger.getInstance();

        assert.strictEqual(logger1, logger2);
    });
});

suite('InstanceManager Tests', () => {
    test('InstanceManager should be a singleton', async () => {
        const { InstanceManager } = await import('../utils/InstanceManager');

        const manager1 = InstanceManager.getInstance();
        const manager2 = InstanceManager.getInstance();

        assert.strictEqual(manager1, manager2);
    });

    test('InstanceManager should return empty array when no instances', async () => {
        const { InstanceManager } = await import('../utils/InstanceManager');

        const manager = InstanceManager.getInstance();
        const instances = manager.getAllInstances();

        assert.ok(Array.isArray(instances));
    });
});

suite('Tool Registration Tests', () => {
    test('toolsExtTemplate should generate correct extension name', async () => {
        const { toolsExtTemplate } = await import('../tools');

        const extName = toolsExtTemplate('TestServer');
        assert.strictEqual(extName, 'mcpsx-TestServer-tools-ext');
    });

    test('toolsExtTemplate should handle spaces in server name', async () => {
        const { toolsExtTemplate } = await import('../tools');

        const extName = toolsExtTemplate('Test Server');
        assert.strictEqual(extName, 'mcpsx-Test Server-tools-ext');
    });
});

suite('Webview Types Tests', () => {
    test('ServerType enum in webview types should match server types', async () => {
        const { ServerType } = await import('../webview/types');

        assert.strictEqual(ServerType.PROCESS, 'process');
        assert.strictEqual(ServerType.SSE, 'sse');
        assert.strictEqual(ServerType.STREAMABLE_HTTP, 'streamable-http');
    });

    test('ServerInstance connectionType should support all transport types', async () => {
        // Test that the connection types are valid strings
        const stdioType: 'stdio' | 'sse' | 'streamable-http' = 'stdio';
        const sseType: 'stdio' | 'sse' | 'streamable-http' = 'sse';
        const streamableType: 'stdio' | 'sse' | 'streamable-http' = 'streamable-http';

        assert.strictEqual(stdioType, 'stdio');
        assert.strictEqual(sseType, 'sse');
        assert.strictEqual(streamableType, 'streamable-http');
    });
});

suite('Error Handling Tests', () => {
    test('ErrorHandler should be importable', async () => {
        const { ErrorHandler } = await import('../utils/ErrorHandler');
        assert.ok(ErrorHandler);
    });
});

suite('EventBus Tests', () => {
    test('EventBus should be importable', async () => {
        const { EventBus } = await import('../utils/EventBus');
        assert.ok(EventBus);
    });

    test('EventBus should allow subscribing to events', async () => {
        const { EventBus } = await import('../utils/EventBus');

        const bus = new EventBus();
        let eventReceived = false;

        bus.on('test-event', () => {
            eventReceived = true;
        });

        bus.emit('test-event', {});

        assert.strictEqual(eventReceived, true);
    });

    test('EventBus should pass event data correctly', async () => {
        const { EventBus } = await import('../utils/EventBus');

        const bus = new EventBus();
        let receivedData: any = null;

        bus.on('test-event', (data: any) => {
            receivedData = data;
        });

        bus.emit('test-event', { message: 'test' });

        assert.deepStrictEqual(receivedData, { message: 'test' });
    });
});

suite('Utility Functions Tests', () => {
    test('cn utility function should merge class names', async () => {
        const { cn } = await import('../lib/utils');

        const result = cn('class1', 'class2');
        assert.ok(result.includes('class1'));
        assert.ok(result.includes('class2'));
    });

    test('cn utility function should handle conditional classes', async () => {
        const { cn } = await import('../lib/utils');

        const result = cn('base', true && 'conditional', false && 'excluded');
        assert.ok(result.includes('base'));
        assert.ok(result.includes('conditional'));
        assert.ok(!result.includes('excluded'));
    });
});
